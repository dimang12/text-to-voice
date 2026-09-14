import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardStats, Generation, GenerationWithUrl, Preset, SavedScript } from "@/lib/types";

const SIGNED_TTL = 60 * 60;

export async function withUrls(supabase: SupabaseClient, rows: Generation[], bookmarked: Set<string>): Promise<GenerationWithUrl[]> {
  if (rows.length === 0) return [];
  const paths = rows.map((r) => r.storage_path);
  const [{ data: play }, { data: dl }] = await Promise.all([
    supabase.storage.from("audio").createSignedUrls(paths, SIGNED_TTL),
    supabase.storage.from("audio").createSignedUrls(paths, SIGNED_TTL, { download: true }),
  ]);
  return rows.map((r, i) => ({
    ...r,
    speed: Number(r.speed),
    duration_seconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
    url: play?.[i]?.signedUrl ?? null,
    download_url: dl?.[i]?.signedUrl ?? null,
    bookmarked: bookmarked.has(r.id),
  }));
}

export async function listGenerations(supabase: SupabaseClient, opts: { bookmarkedOnly?: boolean; limit?: number } = {}) {
  const { data: bm } = await supabase.from("bookmarks").select("generation_id");
  const bookmarked = new Set((bm ?? []).map((b) => b.generation_id as string));

  let query = supabase.from("generations").select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.bookmarkedOnly) {
    if (bookmarked.size === 0) return [];
    query = query.in("id", [...bookmarked]);
  }
  const { data } = await query;
  return withUrls(supabase, (data ?? []) as Generation[], bookmarked);
}

export async function listPresets(supabase: SupabaseClient): Promise<Preset[]> {
  const { data } = await supabase.from("presets").select("id,name,instructions").order("created_at");
  return (data ?? []) as Preset[];
}

export async function dashboardStats(supabase: SupabaseClient): Promise<DashboardStats> {
  const { data } = await supabase.rpc("dashboard_stats").single();
  const row = (data ?? {}) as Partial<Record<keyof DashboardStats, number | string>>;
  return {
    generations: Number(row.generations ?? 0),
    seconds: Number(row.seconds ?? 0),
    bookmarks: Number(row.bookmarks ?? 0),
    presets: Number(row.presets ?? 0),
    scripts: Number(row.scripts ?? 0),
    month_chars: Number(row.month_chars ?? 0),
    quota: Number(row.quota ?? 100000),
  };
}

const SCRIPT_COLUMNS = "id,title,body,voice,model,format,speed,instructions,locale,updated_at";

function normalizeScript(row: SavedScript): SavedScript {
  return { ...row, speed: Number(row.speed) };
}

export async function listScripts(supabase: SupabaseClient): Promise<SavedScript[]> {
  const { data } = await supabase.from("scripts").select(SCRIPT_COLUMNS).order("updated_at", { ascending: false });
  return ((data ?? []) as SavedScript[]).map(normalizeScript);
}

export async function getScript(supabase: SupabaseClient, id: string): Promise<SavedScript | null> {
  const { data } = await supabase.from("scripts").select(SCRIPT_COLUMNS).eq("id", id).maybeSingle();
  return data ? normalizeScript(data as SavedScript) : null;
}
