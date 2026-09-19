import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClipSource, Generation, Project, Timeline } from "@/lib/types";

import { EMPTY_TIMELINE as EMPTY } from "@/lib/timeline";

function normalize(row: Record<string, unknown>): Project {
  const tl = (row.timeline as Timeline | null) ?? EMPTY;
  return {
    id: row.id as string,
    title: row.title as string,
    timeline: tl.tracks?.length ? tl : EMPTY,
    duration_seconds: Number(row.duration_seconds ?? 0),
    updated_at: row.updated_at as string,
    created_at: row.created_at as string,
  };
}

export async function listProjects(supabase: SupabaseClient): Promise<Project[]> {
  const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
  return (data ?? []).map(normalize);
}

export async function getProject(supabase: SupabaseClient, id: string): Promise<Project | null> {
  const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  return data ? normalize(data) : null;
}

/** Every generation the user owns, with a one-hour playback URL, for the Add clip panel. */
export async function listClipSources(supabase: SupabaseClient): Promise<ClipSource[]> {
  const { data } = await supabase
    .from("generations")
    .select("id, script, voice, duration_seconds, storage_path, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as Pick<Generation, "id" | "script" | "voice" | "duration_seconds" | "storage_path">[];
  if (rows.length === 0) return [];
  const { data: signed } = await supabase.storage.from("audio").createSignedUrls(rows.map((r) => r.storage_path), 3600);
  return rows.map((r, i) => ({
    id: r.id,
    label: r.script.length > 80 ? `${r.script.slice(0, 80)}…` : r.script,
    voice: r.voice,
    duration: Number(r.duration_seconds ?? 0),
    url: signed?.[i]?.signedUrl ?? null,
  }));
}
