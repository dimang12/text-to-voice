import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { withUrls } from "@/lib/generations";
import { timelineDuration, timelineSchema } from "@/lib/timeline";
import { requireUser } from "@/lib/supabase/server";
import { FORMATS, MIME_TYPES } from "@/lib/tts";
import type { Generation } from "@/lib/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  timeline: timelineSchema,
  format: z.enum(FORMATS).default("mp3"),
  title: z.string().max(120).optional(),
});

/** Render a project timeline into one audio file via the media service, store it, and record it as a generation. */
export async function POST(req: NextRequest) {
  if (!hasSupabaseEnv()) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const base = process.env.MMS_TTS_URL;
  if (!base) return NextResponse.json({ error: "Media service is not configured" }, { status: 503 });
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid render request" }, { status: 400 });
  const { projectId, timeline, format, title } = parsed.data;
  if (format === "pcm") return NextResponse.json({ error: "PCM is not supported for renders" }, { status: 400 });

  const clips = timeline.tracks.flatMap((t) => t.clips);
  if (clips.length === 0) return NextResponse.json({ error: "The timeline is empty" }, { status: 400 });

  // Fetch each distinct source once and send it along with the edit list.
  const sourceIds = [...new Set(clips.map((c) => c.sourceId))];
  const { data: sources } = await supabase.from("generations").select("id, storage_path").in("id", sourceIds);
  const byId = new Map((sources ?? []).map((s) => [s.id as string, s.storage_path as string]));
  if (byId.size !== sourceIds.length) return NextResponse.json({ error: "A clip refers to audio that no longer exists" }, { status: 400 });

  const form = new FormData();
  const fileIndex = new Map<string, number>();
  for (const id of sourceIds) {
    const { data, error } = await supabase.storage.from("audio").download(byId.get(id)!);
    if (error || !data) return NextResponse.json({ error: `Could not read source audio: ${error?.message}` }, { status: 500 });
    fileIndex.set(id, fileIndex.size);
    form.append("files", data, `${id}.bin`);
  }
  form.append("edl", JSON.stringify({ clips: clips.map((c) => ({ ...c, file: fileIndex.get(c.sourceId) })) }));
  form.append("format", format);

  let audio: Buffer;
  let seconds = timelineDuration(timeline);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/render`, { method: "POST", body: form, signal: AbortSignal.timeout(300_000) });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      return NextResponse.json({ error: detail.detail ?? `Render failed (${res.status})` }, { status: 502 });
    }
    audio = Buffer.from(await res.arrayBuffer());
    const d = Number(res.headers.get("X-Duration-Seconds"));
    if (Number.isFinite(d)) seconds = d;
  } catch {
    return NextResponse.json({ error: "Media service is offline" }, { status: 503 });
  }

  const id = crypto.randomUUID();
  const storagePath = `${user.id}/${id}.${format}`;
  const { error: upErr } = await supabase.storage.from("audio").upload(storagePath, audio, { contentType: MIME_TYPES[format], upsert: false });
  if (upErr) return NextResponse.json({ error: `Could not save render: ${upErr.message}` }, { status: 500 });

  const script = (title ?? "Studio render").trim() || "Studio render";
  const { data: inserted, error: insErr } = await supabase
    .from("generations")
    .insert({ id, user_id: user.id, script, engine: "studio", voice: "mix", model: "render", format, speed: 1, instructions: null, locale: "en",
      char_count: 0, duration_seconds: Math.round(seconds * 100) / 100, byte_size: audio.byteLength, storage_path: storagePath })
    .select("*")
    .single();
  if (insErr || !inserted) {
    await supabase.storage.from("audio").remove([storagePath]);
    return NextResponse.json({ error: `Could not record render: ${insErr?.message}` }, { status: 500 });
  }
  await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);
  const [generation] = await withUrls(supabase, [inserted as Generation], new Set());
  return NextResponse.json({ generation });
}
