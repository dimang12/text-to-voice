import type { Format, Model, Voice } from "@/lib/tts";

export type Generation = {
  id: string;
  user_id: string;
  script: string;
  voice: Voice;
  model: Model;
  format: Format;
  speed: number;
  instructions: string | null;
  locale: string;
  char_count: number;
  duration_seconds: number | null;
  byte_size: number;
  storage_path: string;
  created_at: string;
};

export type GenerationWithUrl = Generation & {
  url: string | null;
  download_url: string | null;
  bookmarked: boolean;
};

export type Preset = {
  id: string;
  name: string;
  instructions: string;
};

export type SavedScript = {
  id: string;
  title: string;
  body: string;
  voice: Voice;
  model: Model;
  format: Format;
  speed: number;
  instructions: string | null;
  locale: string;
  updated_at: string;
};

export type DashboardStats = {
  generations: number;
  seconds: number;
  bookmarks: number;
  presets: number;
  scripts: number;
  month_chars: number;
  quota: number;
};
