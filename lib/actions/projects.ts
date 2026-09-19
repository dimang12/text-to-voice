"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { timelineDuration, timelineSchema } from "@/lib/timeline";
import type { Timeline } from "@/lib/types";

export async function createProject(title?: string) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, title: (title ?? "").trim().slice(0, 120) || "Untitled project" })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create project");
  revalidatePath("/", "layout");
  redirect(`/studio/${data.id}`);
}

/** Start a project containing one generation as its first clip, then open the editor. */
export async function createProjectFromGeneration(generationId: string) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const { data: g } = await supabase.from("generations").select("id, script, duration_seconds").eq("id", generationId).maybeSingle();
  if (!g) throw new Error("Clip not found");
  const duration = Math.max(0.5, Number(g.duration_seconds ?? 1));
  const timeline: Timeline = {
    tracks: [{ id: "voice", name: "Voice", clips: [{ id: crypto.randomUUID(), sourceId: g.id as string, start: 0, offset: 0, duration, gain: 1, fadeIn: 0, fadeOut: 0 }] }],
  };
  const title = String(g.script).slice(0, 60).trim() || "Untitled project";
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, title, timeline, duration_seconds: duration })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create project");
  revalidatePath("/", "layout");
  redirect(`/studio/${data.id}`);
}

export async function saveProject(id: string, timeline: Timeline, title?: string): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Sign in required" };
  const parsed = timelineSchema.safeParse(timeline);
  if (!parsed.success) return { ok: false, error: "Invalid timeline" };
  const updated_at = new Date().toISOString();
  const patch: Record<string, unknown> = { timeline: parsed.data, duration_seconds: Math.round(timelineDuration(parsed.data) * 100) / 100, updated_at };
  if (title !== undefined) patch.title = title.trim().slice(0, 120) || "Untitled project";
  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, updatedAt: updated_at };
}

export async function deleteProject(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) return;
  await supabase.from("projects").delete().eq("id", id);
  revalidatePath("/", "layout");
}
