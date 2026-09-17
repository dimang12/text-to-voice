import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chunkText } from "@/lib/chunk";
import { hasSupabaseEnv } from "@/lib/env";
import { getEngine } from "@/lib/engines/catalog";
import { listEngineViews, resolveCredentials } from "@/lib/engine-settings";
import { estimateSeconds } from "@/lib/format";
import { withUrls } from "@/lib/generations";
import { ProviderOfflineError, synthesizeWithMms } from "@/lib/providers/mms";
import { synthesizeWithOpenAI, type SynthesisInput, type SynthesisResult } from "@/lib/providers/openai";
import { requireUser } from "@/lib/supabase/server";
import { MAX_CHUNK_CHARS, MIME_TYPES, ttsRequestSchema } from "@/lib/tts";
import type { Generation } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const previewSchema = z.object({
  preview: z.literal(true),
  engine: z.string().min(1),
  voice: z.string().min(1),
  text: z.string().trim().min(1).max(200),
});

async function synthesize(supabase: SupabaseClient, engineId: string, input: SynthesisInput): Promise<SynthesisResult> {
  const engine = getEngine(engineId);
  if (!engine) throw new Error("Unknown engine");
  if (engine.id === "mms") {
    const lang = engine.voices.find((v) => v.id === input.voice)?.languages[0] === "km" ? "khm" : "eng";
    return synthesizeWithMms(input, lang);
  }
  const creds = await resolveCredentials(supabase, engine);
  if (!creds.apiKey) throw new ProviderOfflineError("No API key for this engine. Add one in Settings.");
  return synthesizeWithOpenAI(input, { apiKey: creds.apiKey, baseUrl: creds.baseUrl });
}

function errorStatus(err: unknown): number {
  if (err instanceof ProviderOfflineError) return 503;
  if (typeof err === "object" && err && "status" in err && typeof err.status === "number") return err.status;
  return 502;
}

export async function POST(req: NextRequest) {
  if (!hasSupabaseEnv()) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Short voice preview: generated on the fly, never stored.
  const preview = previewSchema.safeParse(body);
  if (preview.success) {
    const engine = getEngine(preview.data.engine);
    if (!engine || !engine.voices.some((v) => v.id === preview.data.voice)) {
      return NextResponse.json({ error: "Unknown voice" }, { status: 400 });
    }
    try {
      const result = await synthesize(supabase, engine.id, {
        text: preview.data.text, voice: preview.data.voice, model: engine.models[0].id, format: "mp3", speed: 1,
      });
      return new NextResponse(new Uint8Array(result.audio), {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" },
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Preview failed" }, { status: errorStatus(err) });
    }
  }

  const parsed = ttsRequestSchema.extend({ locale: z.enum(["en", "km"]).default("en") }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const { text, engine: engineId, voice, model, format, speed, instructions, locale } = parsed.data;

  // Validate the request against the engine's manifest and the user's settings.
  const engine = getEngine(engineId);
  if (!engine) return NextResponse.json({ error: "Unknown engine" }, { status: 400 });
  const modelSpec = engine.models.find((m) => m.id === model);
  if (!modelSpec) return NextResponse.json({ error: `Model ${model} is not available on ${engineId}` }, { status: 400 });
  if (!engine.voices.some((v) => v.id === voice)) return NextResponse.json({ error: `Voice ${voice} is not available on ${engineId}` }, { status: 400 });
  if (!engine.formats.includes(format)) return NextResponse.json({ error: `Format ${format} is not supported by ${engineId}` }, { status: 400 });
  if (speed < engine.speed.min || speed > engine.speed.max) return NextResponse.json({ error: "Speed is out of range for this engine" }, { status: 400 });
  if (text.length > engine.maxChars) return NextResponse.json({ error: `Text is over the ${engine.maxChars.toLocaleString()} character limit for this engine` }, { status: 400 });
  const view = (await listEngineViews(supabase)).find((e) => e.id === engineId);
  if (!view?.status.available || !view.status.enabled) return NextResponse.json({ error: "This engine is not set up. Open Settings to configure it." }, { status: 409 });
  if (engine.id === "openai" && chunkText(text, MAX_CHUNK_CHARS).length > 1 && format !== "mp3") {
    return NextResponse.json({ error: `Text longer than ${MAX_CHUNK_CHARS} characters is only supported in MP3 format` }, { status: 400 });
  }

  // Quota check.
  const { data: stats } = await supabase.rpc("dashboard_stats").single();
  const used = Number((stats as { month_chars?: number } | null)?.month_chars ?? 0);
  const quota = Number((stats as { quota?: number } | null)?.quota ?? 100000);
  if (used + text.length > quota) return NextResponse.json({ error: "Monthly character quota reached" }, { status: 429 });

  let result: SynthesisResult;
  try {
    result = await synthesize(supabase, engine.id, {
      text, voice, model, format, speed, instructions: modelSpec.instructions ? instructions : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Speech generation failed" }, { status: errorStatus(err) });
  }

  const id = crypto.randomUUID();
  const storagePath = `${user.id}/${id}.${format}`;
  const { error: uploadError } = await supabase.storage.from("audio").upload(storagePath, result.audio, { contentType: MIME_TYPES[format], upsert: false });
  if (uploadError) return NextResponse.json({ error: `Could not save audio: ${uploadError.message}` }, { status: 500 });

  const row = {
    id, user_id: user.id, script: text, engine: engine.id, voice, model, format, speed,
    instructions: modelSpec.instructions ? instructions ?? null : null,
    locale, char_count: text.length,
    duration_seconds: result.durationSeconds ?? Math.round(estimateSeconds(text, speed) * 100) / 100,
    byte_size: result.audio.byteLength, storage_path: storagePath,
  };
  const { data: inserted, error: insertError } = await supabase.from("generations").insert(row).select("*").single();
  if (insertError || !inserted) {
    await supabase.storage.from("audio").remove([storagePath]);
    return NextResponse.json({ error: `Could not record generation: ${insertError?.message}` }, { status: 500 });
  }
  await supabase.rpc("add_usage", { p_chars: text.length });

  const [generation] = await withUrls(supabase, [inserted as Generation], new Set());
  return NextResponse.json({ generation, chunks: result.chunks });
}
