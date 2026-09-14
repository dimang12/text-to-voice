import { z } from "zod";

export const VOICES = [
  "sokha",
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;

export const MODELS = ["gpt-4o-mini-tts", "tts-1", "tts-1-hd", "mms-tts"] as const;

export type Provider = "openai" | "mms";

export const MODEL_PROVIDER: Record<Model, Provider> = {
  "gpt-4o-mini-tts": "openai",
  "tts-1": "openai",
  "tts-1-hd": "openai",
  "mms-tts": "mms",
};

/** Which engine speaks each voice, plus the MMS language code for self-hosted voices. */
export const VOICE_PROVIDER: Record<Voice, { provider: Provider; lang?: string }> = {
  sokha: { provider: "mms", lang: "khm" },
  alloy: { provider: "openai" },
  ash: { provider: "openai" },
  ballad: { provider: "openai" },
  coral: { provider: "openai" },
  echo: { provider: "openai" },
  fable: { provider: "openai" },
  onyx: { provider: "openai" },
  nova: { provider: "openai" },
  sage: { provider: "openai" },
  shimmer: { provider: "openai" },
  verse: { provider: "openai" },
  marin: { provider: "openai" },
  cedar: { provider: "openai" },
};

export function voicesFor(model: Model): Voice[] {
  const provider = MODEL_PROVIDER[model];
  return VOICES.filter((v) => VOICE_PROVIDER[v].provider === provider);
}

export const FORMATS = ["mp3", "opus", "aac", "flac", "wav", "pcm"] as const;

export const MIME_TYPES: Record<Format, string> = {
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  pcm: "audio/L16",
};

export const MAX_CHUNK_CHARS = 4096;
export const MAX_TOTAL_CHARS = 20000;

export const ttsRequestSchema = z.object({
  text: z.string().trim().min(1, "Text is required").max(MAX_TOTAL_CHARS),
  voice: z.enum(VOICES).default("alloy"),
  model: z.enum(MODELS).default("gpt-4o-mini-tts"),
  format: z.enum(FORMATS).default("mp3"),
  speed: z.number().min(0.25).max(4).default(1),
  instructions: z.string().trim().max(1000).optional(),
});

export type Voice = (typeof VOICES)[number];
export type Model = (typeof MODELS)[number];
export type Format = (typeof FORMATS)[number];
export type TtsRequest = z.infer<typeof ttsRequestSchema>;
export type TtsRequestInput = z.input<typeof ttsRequestSchema>;
