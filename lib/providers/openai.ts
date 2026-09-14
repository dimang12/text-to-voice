import { chunkText } from "@/lib/chunk";
import { getOpenAI } from "@/lib/openai";
import { MAX_CHUNK_CHARS, type Format, type Model, type Voice } from "@/lib/tts";

export type SynthesisInput = {
  text: string;
  voice: Voice;
  model: Model;
  format: Format;
  speed: number;
  instructions?: string;
};

export type SynthesisResult = { audio: Buffer; chunks: number; durationSeconds?: number };

export async function synthesizeWithOpenAI(input: SynthesisInput): Promise<SynthesisResult> {
  const openai = getOpenAI();
  const chunks = chunkText(input.text, MAX_CHUNK_CHARS);
  const buffers: Buffer[] = [];
  for (const text of chunks) {
    const res = await openai.audio.speech.create({
      model: input.model,
      voice: input.voice,
      input: text,
      response_format: input.format,
      speed: input.speed,
      ...(input.model === "gpt-4o-mini-tts" && input.instructions ? { instructions: input.instructions } : {}),
    });
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }
  return { audio: Buffer.concat(buffers), chunks: chunks.length };
}
