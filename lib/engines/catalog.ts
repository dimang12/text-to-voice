import { mmsEngine } from "@/lib/engines/mms";
import { openaiEngine } from "@/lib/engines/openai";
import type { EngineManifest, VoiceSpec } from "@/lib/engines/types";

/** Every engine the app knows about. Order is the display order. Safe to import on the client: no secrets here. */
export const ENGINES: EngineManifest[] = [mmsEngine, openaiEngine];

export function getEngine(id: string): EngineManifest | undefined {
  return ENGINES.find((e) => e.id === id);
}

export function findVoice(voiceId: string): { engine: EngineManifest; voice: VoiceSpec; index: number } | undefined {
  let index = 0;
  for (const engine of ENGINES) {
    for (const voice of engine.voices) {
      if (voice.id === voiceId) return { engine, voice, index };
      index++;
    }
  }
  return undefined;
}

export function engineForModel(modelId: string): EngineManifest | undefined {
  return ENGINES.find((e) => e.models.some((m) => m.id === modelId));
}

export const VOICE_COUNT = ENGINES.reduce((n, e) => n + e.voices.length, 0);
