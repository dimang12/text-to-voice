import { z } from "zod";
import type { Clip, Timeline } from "@/lib/types";

const clipSchema = z.object({
  id: z.string().min(1).max(64),
  sourceId: z.string().uuid(),
  start: z.number().min(0),
  offset: z.number().min(0),
  duration: z.number().min(0.01),
  gain: z.number().min(0).max(4),
  fadeIn: z.number().min(0).max(30),
  fadeOut: z.number().min(0).max(30),
});

export const timelineSchema = z.object({
  tracks: z.array(z.object({ id: z.string().min(1), name: z.string().max(60), clips: z.array(clipSchema).max(500) })).min(1).max(8),
});

export function timelineDuration(tl: Timeline): number {
  return tl.tracks.reduce((m, t) => t.clips.reduce((mm, c) => Math.max(mm, c.start + c.duration), m), 0);
}

export const EMPTY_TIMELINE: Timeline = { tracks: [{ id: "voice", name: "Voice", clips: [] }] };

export function sortedClips(clips: Clip[]): Clip[] {
  return [...clips].sort((a, b) => a.start - b.start);
}
