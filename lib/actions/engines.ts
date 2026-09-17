"use server";

import { revalidatePath } from "next/cache";
import { encrypt, hasAppSecret } from "@/lib/crypto";
import { getEngine } from "@/lib/engines/catalog";
import { resolveCredentials } from "@/lib/engine-settings";
import { testMms } from "@/lib/providers/mms";
import { testOpenAI } from "@/lib/providers/openai";
import { requireUser } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function saveEngineConfig(engineId: string, values: Record<string, string>, enabled: boolean): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Sign in required" };
  const engine = getEngine(engineId);
  if (!engine) return { ok: false, error: "Unknown engine" };

  const { data: existing } = await supabase.from("user_engines").select("config").eq("engine_id", engineId).maybeSingle();
  const config: Record<string, string> = { ...((existing?.config as Record<string, string>) ?? {}) };

  for (const field of engine.credentials) {
    const raw = (values[field.key] ?? "").trim();
    if (field.secret) {
      if (!raw) continue; // blank keeps the stored secret
      if (!hasAppSecret()) return { ok: false, error: "Server is missing APP_SECRET; keys cannot be stored" };
      config[field.key] = encrypt(raw.slice(0, 500));
    } else {
      if (raw) config[field.key] = raw.slice(0, 500); else delete config[field.key];
    }
  }
  const { error } = await supabase.from("user_engines").upsert({ user_id: user.id, engine_id: engineId, enabled, config, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeEngineConfig(engineId: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Sign in required" };
  await supabase.from("user_engines").delete().eq("engine_id", engineId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setEngineDefaults(engineId: string, modelId: string, voiceId: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Sign in required" };
  const engine = getEngine(engineId);
  if (!engine || !engine.models.some((m) => m.id === modelId) || !engine.voices.some((v) => v.id === voiceId)) {
    return { ok: false, error: "Invalid selection" };
  }
  const { error } = await supabase.from("profiles").update({ default_engine: engineId, default_model: modelId, default_voice: voiceId }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Try the engine with the stored (or site) credentials. */
export async function testEngine(engineId: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Sign in required" };
  const engine = getEngine(engineId);
  if (!engine) return { ok: false, error: "Unknown engine" };
  try {
    if (engine.id === "mms") await testMms();
    else if (engine.id === "openai") {
      const creds = await resolveCredentials(supabase, engine);
      if (!creds.apiKey) return { ok: false, error: "No API key saved yet" };
      await testOpenAI({ apiKey: creds.apiKey, baseUrl: creds.baseUrl });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Test failed" };
  }
}
