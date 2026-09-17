import OpenAI from "openai";
import { chunkText } from "@/lib/chunk";
import { MAX_CHUNK_CHARS, type Format } from "@/lib/tts";

export type SynthesisInput = {
  text: string;
  voice: string;
  model: string;
  format: Format;
  speed: number;
  instructions?: string;
};

export type SynthesisResult = { audio: Buffer; chunks: number; durationSeconds?: number };

export type OpenAICredentials = { apiKey: string; baseUrl?: string };

export async function synthesizeWithOpenAI(input: SynthesisInput, creds: OpenAICredentials): Promise<SynthesisResult> {
  const openai = new OpenAI({ apiKey: creds.apiKey, baseURL: creds.baseUrl || undefined });
  const chunks = chunkText(input.text, MAX_CHUNK_CHARS);
  const buffers: Buffer[] = [];
  for (const text of chunks) {
    const res = await openai.audio.speech.create({
      model: input.model,
      voice: input.voice,
      input: text,
      response_format: input.format,
      speed: input.speed,
      ...(input.instructions ? { instructions: input.instructions } : {}),
    });
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }
  return { audio: Buffer.concat(buffers), chunks: chunks.length };
}

/** Cheap connectivity check used by the Settings page. */
export async function testOpenAI(creds: OpenAICredentials): Promise<void> {
  const openai = new OpenAI({ apiKey: creds.apiKey, baseURL: creds.baseUrl || undefined });
  await openai.models.list();
}
