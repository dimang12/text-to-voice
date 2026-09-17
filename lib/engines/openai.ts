import type { EngineManifest } from "@/lib/engines/types";

export const openaiEngine: EngineManifest = {
  id: "openai",
  nameKey: "openai.name",
  descriptionKey: "openai.description",
  kind: "external",
  docsUrl: "https://platform.openai.com/api-keys",
  credentials: [
    { key: "apiKey", labelKey: "apiKey", placeholder: "sk-…", secret: true, required: true },
    { key: "baseUrl", labelKey: "baseUrl", placeholder: "https://api.openai.com/v1", helpKey: "baseUrlHelp" },
  ],
  models: [
    { id: "gpt-4o-mini-tts", label: "gpt-4o-mini-tts", noteKey: "modelSteerable", instructions: true },
    { id: "tts-1", label: "tts-1", noteKey: "modelFast", instructions: false },
    { id: "tts-1-hd", label: "tts-1-hd", noteKey: "modelHd", instructions: false },
  ],
  voices: [
    { id: "alloy", name: "Alloy", tagKey: "alloy", languages: ["en"], gradient: "radial-gradient(120% 90% at 30% 20%, #5b7cff 0%, #2b2f6b 55%, #ff5fa8 130%)" },
    { id: "ash", name: "Ash", tagKey: "ash", languages: ["en"], gradient: "radial-gradient(110% 100% at 60% 40%, #ff8f5f 0%, #7a2f6e 60%, #2c1f4d 120%)" },
    { id: "ballad", name: "Ballad", tagKey: "ballad", languages: ["en"], gradient: "radial-gradient(120% 100% at 40% 60%, #b98cff 0%, #4a3d9e 60%, #1d1e4a 120%)" },
    { id: "coral", name: "Coral", tagKey: "coral", languages: ["en"], gradient: "radial-gradient(120% 100% at 70% 30%, #ff8ac9 0%, #7f3fb3 60%, #2a2c7a 120%)" },
    { id: "echo", name: "Echo", tagKey: "echo", languages: ["en"], gradient: "radial-gradient(120% 100% at 30% 30%, #4fd0ff 0%, #2a5db0 60%, #4a2168 120%)" },
    { id: "fable", name: "Fable", tagKey: "fable", languages: ["en"], gradient: "radial-gradient(120% 100% at 50% 70%, #ff6fb5 0%, #8b3aa8 50%, #1a1f55 120%)" },
    { id: "onyx", name: "Onyx", tagKey: "onyx", languages: ["en"], gradient: "radial-gradient(120% 100% at 40% 40%, #5c6cff 0%, #1f2450 60%, #0b0c22 120%)" },
    { id: "nova", name: "Nova", tagKey: "nova", languages: ["en"], gradient: "radial-gradient(120% 100% at 60% 60%, #ffa26b 0%, #d4478f 55%, #3a2a8a 120%)" },
    { id: "sage", name: "Sage", tagKey: "sage", languages: ["en"], gradient: "radial-gradient(120% 100% at 30% 60%, #6ee7ff 0%, #3b7fb8 55%, #3a2b6f 120%)" },
    { id: "shimmer", name: "Shimmer", tagKey: "shimmer", languages: ["en"], gradient: "radial-gradient(120% 100% at 60% 30%, #ffd1f5 0%, #c26fe0 50%, #4a3fb0 120%)" },
    { id: "verse", name: "Verse", tagKey: "verse", languages: ["en"], gradient: "radial-gradient(120% 100% at 40% 40%, #9d7bff 0%, #5c3fd0 55%, #24215a 120%)" },
    { id: "marin", name: "Marin", tagKey: "marin", languages: ["en"], gradient: "radial-gradient(120% 100% at 30% 70%, #63c9ff 0%, #4a58c9 55%, #7d2f9e 120%)" },
    { id: "cedar", name: "Cedar", tagKey: "cedar", languages: ["en"], gradient: "radial-gradient(120% 100% at 60% 30%, #ff9d8a 0%, #b34a7c 55%, #2f2568 120%)" },
  ],
  formats: ["mp3", "opus", "aac", "flac", "wav", "pcm"],
  speed: { min: 0.25, max: 4, step: 0.05 },
  maxChars: 20000,
  chunkChars: 4096,
  stylePresets: true,
};
