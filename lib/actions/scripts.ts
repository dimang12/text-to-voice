"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { ttsRequestSchema } from "@/lib/tts";
import { z } from "zod";

const scriptSchema = ttsRequestSchema.extend({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  locale: z.enum(["en", "km"]).default("en"),
});

export type ScriptInput = z.input<typeof scriptSchema>;

export async function saveScript(input: ScriptInput): Promise<{ id: string } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sign in required" };
  const parsed = scriptSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const { id, title, text, voice, model, format, speed, instructions, locale } = parsed.data;
  void parsed.data.engine;
  const row = { title, body: text, voice, model, format, speed, instructions: instructions || null, locale, updated_at: new Date().toISOString() };

  if (id) {
    const { error } = await supabase.from("scripts").update(row).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { id };
  }
  const { data, error } = await supabase.from("scripts").insert({ ...row, user_id: user.id }).select("id").single();
  if (error || !data) return { error: error?.message ?? "Could not save" };
  revalidatePath("/", "layout");
  return { id: data.id as string };
}

export async function deleteScript(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) return;
  await supabase.from("scripts").delete().eq("id", id);
  revalidatePath("/", "layout");
}
