"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

export async function toggleBookmark(generationId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return;
  const { data } = await supabase.from("bookmarks").select("generation_id").eq("generation_id", generationId).maybeSingle();
  if (data) {
    await supabase.from("bookmarks").delete().eq("generation_id", generationId);
  } else {
    await supabase.from("bookmarks").insert({ user_id: user.id, generation_id: generationId });
  }
  revalidatePath("/", "layout");
}

export async function deleteGeneration(generationId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return;
  const { data } = await supabase.from("generations").select("storage_path").eq("id", generationId).maybeSingle();
  if (!data) return;
  await supabase.storage.from("audio").remove([data.storage_path as string]);
  await supabase.from("generations").delete().eq("id", generationId);
  revalidatePath("/", "layout");
}

export async function savePreset(name: string, instructions: string) {
  const { supabase, user } = await requireUser();
  if (!user) return;
  const n = name.trim().slice(0, 60);
  const i = instructions.trim().slice(0, 1000);
  if (!n || !i) return;
  await supabase.from("presets").insert({ user_id: user.id, name: n, instructions: i });
  revalidatePath("/", "layout");
}

export async function deletePreset(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) return;
  await supabase.from("presets").delete().eq("id", id);
  revalidatePath("/", "layout");
}
