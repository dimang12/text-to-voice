import { z } from "zod";

export const FORMATS = ["mp3", "opus", "aac", "flac", "wav", "pcm"] as const;
export type Format = (typeof FORMATS)[number];

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

/** Shape of a generation request. Engine, model and voice are validated against the catalog in the route. */
export const ttsRequestSchema = z.object({
  text: z.string().trim().min(1, "Text is required").max(MAX_TOTAL_CHARS),
  engine: z.string().min(1).default("openai"),
  model: z.string().min(1),
  voice: z.string().min(1),
  format: z.enum(FORMATS).default("mp3"),
  speed: z.number().min(0.25).max(4).default(1),
  instructions: z.string().trim().max(1000).optional(),
});

export type TtsRequest = z.infer<typeof ttsRequestSchema>;
