import type { SynthesisInput, SynthesisResult } from "@/lib/providers/openai";

export class ProviderOfflineError extends Error {}

export function hasMmsEnv(): boolean {
  return Boolean(process.env.MMS_TTS_URL);
}

/** Calls the self-hosted MMS service in services/tts-mms. It chunks and joins audio itself. */
export async function synthesizeWithMms(input: SynthesisInput, lang: string): Promise<SynthesisResult> {
  const base = process.env.MMS_TTS_URL;
  if (!base) throw new ProviderOfflineError("Self-hosted Khmer engine is not configured");
  if (input.format === "pcm") throw new Error("PCM output is not supported by the Khmer engine");

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.text, lang, speed: Math.min(2, Math.max(0.5, input.speed)), format: input.format }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new ProviderOfflineError("Self-hosted Khmer engine is offline");
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail ?? `Khmer engine failed (${res.status})`);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  const duration = Number(res.headers.get("X-Duration-Seconds"));
  return { audio, chunks: 1, durationSeconds: Number.isFinite(duration) ? duration : undefined };
}

export async function testMms(): Promise<void> {
  const base = process.env.MMS_TTS_URL;
  if (!base) throw new ProviderOfflineError("Self-hosted Khmer engine is not configured");
  const res = await fetch(`${base.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new ProviderOfflineError("Self-hosted Khmer engine is offline");
}
