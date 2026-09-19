import type { Format } from "@/lib/tts";

export type Generation = {
  id: string;
  user_id: string;
  script: string;
  engine: string;
  voice: string;
  model: string;
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
  voice: string;
  model: string;
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

/** One piece of a source generation placed on the Studio timeline. Times are seconds. */
export type Clip = {
  id: string;
  sourceId: string;
  start: number;
  offset: number;
  duration: number;
  gain: number;
  fadeIn: number;
  fadeOut: number;
};

export type Track = { id: string; name: string; clips: Clip[] };
export type Timeline = { tracks: Track[] };

export type Project = {
  id: string;
  title: string;
  timeline: Timeline;
  duration_seconds: number;
  updated_at: string;
  created_at: string;
};

/** A generation usable as editor source material. */
export type ClipSource = {
  id: string;
  label: string;
  voice: string;
  duration: number;
  url: string | null;
};
