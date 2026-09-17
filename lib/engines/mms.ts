import type { EngineManifest } from "@/lib/engines/types";

export const mmsEngine: EngineManifest = {
  id: "mms",
  nameKey: "mms.name",
  descriptionKey: "mms.description",
  kind: "self-hosted",
  credentials: [],
  models: [{ id: "mms-tts", label: "MMS", noteKey: "modelMms", instructions: false }],
  voices: [
    { id: "sokha", name: "Sokha", tagKey: "sokha", languages: ["km"], gradient: "radial-gradient(120% 100% at 35% 30%, #ffd66b 0%, #e0532f 55%, #4a1d6e 120%)" },
  ],
  formats: ["mp3", "opus", "aac", "flac", "wav"],
  speed: { min: 0.5, max: 2, step: 0.05 },
  maxChars: 6000,
  stylePresets: false,
};
