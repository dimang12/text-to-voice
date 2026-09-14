import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chunkText } from "@/lib/chunk";
import { getOpenAI } from "@/lib/openai";
import { estimateSeconds } from "@/lib/format";
import { ProviderOfflineError, synthesizeWithMms } from "@/lib/providers/mms";
import { synthesizeWithOpenAI } from "@/lib/providers/openai";
import { withUrls } from "@/lib/generations";
import { hasSupabaseEnv } from "@/lib/env";
import { requireUser } from "@/lib/supabase/server";
import { MAX_CHUNK_CHARS, MIME_TYPES, MODEL_PROVIDER, VOICES, VOICE_PROVIDER, ttsRequestSchema } from "@/lib/tts";
import type { Generation } from "@/lib/types";

export const runtime = "nodejs";

const previewSchema = z.object({
  preview: z.literal(true),
  voice: z.enum(VOICES),
  text: z.string().trim().min(1).max(200),
});

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
    try {
      const voice = preview.data.voice;
      const input = { text: preview.data.text, voice, format: "mp3" as const, speed: 1 };
      const result = VOICE_PROVIDER[voice].provider === "mms"
        ? await synthesizeWithMms({ ...input, model: "mms-tts" })
        : await synthesizeWithOpenAI({ ...input, model: "gpt-4o-mini-tts" });
      return new NextResponse(new Uint8Array(result.audio), {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" },
      });
    } catch (err) {
      const status = err instanceof ProviderOfflineError ? 503 : 502;
      return NextResponse.json({ error: err instanceof Error ? err.message : "Preview failed" }, { status });
    }
  }

  const parsed = ttsRequestSchema.extend({ locale: z.enum(["en", "km"]).default("en") }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const { text, voice, model, format, speed, instructions, locale } = parsed.data;
  const provider = MODEL_PROVIDER[model];
  if (VOICE_PROVIDER[voice].provider !== provider) {
    return NextResponse.json({ error: `Voice ${voice} is not available on ${model}` }, { status: 400 });
  }
  if (provider === "openai") {
    try {
      getOpenAI();
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Server misconfigured" }, { status: 500 });
    }
    const chunks = chunkText(text, MAX_CHUNK_CHARS);
    if (chunks.length > 1 && format !== "mp3") {
      return NextResponse.json({ error: `Text longer than ${MAX_CHUNK_CHARS} characters is only supported in MP3 format` }, { status: 400 });
    }
  }

  // Quota check.
  const { data: stats } = await supabase.rpc("dashboard_stats").single();
  const used = Number((stats as { month_chars?: number } | null)?.month_chars ?? 0);
  const quota = Number((stats as { quota?: number } | null)?.quota ?? 100000);
  if (used + text.length > quota) {
    return NextResponse.json({ error: "Monthly character quota reached" }, { status: 429 });
  }

  let audio: Buffer;
  let chunkCount = 1;
  let measuredSeconds: number | undefined;
  try {
    const input = { text, voice, model, format, speed, instructions };
    const result = provider === "mms" ? await synthesizeWithMms(input) : await synthesizeWithOpenAI(input);
    audio = result.audio;
    chunkCount = result.chunks;
    measuredSeconds = result.durationSeconds;
  } catch (err) {
    const status = err instanceof ProviderOfflineError
      ? 503
      : typeof err === "object" && err && "status" in err && typeof err.status === "number" ? err.status : 502;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Speech generation failed" }, { status });
  }

  const id = crypto.randomUUID();
  const storagePath = `${user.id}/${id}.${format}`;
  const { error: uploadError } = await supabase.storage
    .from("audio")
    .upload(storagePath, audio, { contentType: MIME_TYPES[format], upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: `Could not save audio: ${uploadError.message}` }, { status: 500 });
  }

  const row = {
    id,
    user_id: user.id,
    script: text,
    voice,
    model,
    format,
    speed,
    instructions: model === "gpt-4o-mini-tts" ? instructions ?? null : null,
    locale,
    char_count: text.length,
    duration_seconds: measuredSeconds ?? Math.round(estimateSeconds(text, speed) * 100) / 100,
    byte_size: audio.byteLength,
    storage_path: storagePath,
  };
  const { data: inserted, error: insertError } = await supabase.from("generations").insert(row).select("*").single();
  if (insertError || !inserted) {
    await supabase.storage.from("audio").remove([storagePath]);
    return NextResponse.json({ error: `Could not record generation: ${insertError?.message}` }, { status: 500 });
  }
  await supabase.rpc("add_usage", { p_chars: text.length });

  const [generation] = await withUrls(supabase, [inserted as Generation], new Set());
  return NextResponse.json({ generation, chunks: chunkCount });
}
