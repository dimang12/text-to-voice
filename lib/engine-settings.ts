import type { SupabaseClient } from "@supabase/supabase-js";
import { ENGINES } from "@/lib/engines/catalog";
import type { EngineManifest, EngineView } from "@/lib/engines/types";
import { decrypt, hasAppSecret } from "@/lib/crypto";
import { hasMmsEnv } from "@/lib/providers/mms";

type StoredConfig = { enabled: boolean; config: Record<string, string> };

export type EngineDefaults = { engine: string | null; model: string | null; voice: string | null };

async function loadStored(supabase: SupabaseClient): Promise<Map<string, StoredConfig>> {
  const { data } = await supabase.from("user_engines").select("engine_id, enabled, config");
  const map = new Map<string, StoredConfig>();
  for (const row of data ?? []) {
    map.set(row.engine_id as string, { enabled: Boolean(row.enabled), config: (row.config ?? {}) as Record<string, string> });
  }
  return map;
}

/** Site-level availability: is this engine reachable without any user input? */
function siteConfigured(engine: EngineManifest): boolean {
  if (engine.id === "mms") return hasMmsEnv();
  if (engine.id === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return false;
}

/** Manifests decorated with this user's status. Secret fields are reported as set/unset, never as values. */
export async function listEngineViews(supabase: SupabaseClient): Promise<EngineView[]> {
  const stored = await loadStored(supabase);
  return ENGINES.map((engine) => {
    const row = stored.get(engine.id);
    const required = engine.credentials.filter((f) => f.required);
    const userConfigured = required.length > 0 && required.every((f) => Boolean(row?.config[f.key]));
    const site = siteConfigured(engine);
    const fields: Record<string, string> = {};
    for (const f of engine.credentials) {
      const v = row?.config[f.key];
      fields[f.key] = v ? (f.secret ? "••••••••" : v) : "";
    }
    const available = engine.kind === "self-hosted" ? site : userConfigured || site;
    return {
      ...engine,
      status: {
        available,
        configured: available,
        enabled: row?.enabled ?? true,
        source: userConfigured ? "user" : site ? "site" : null,
        fields,
      },
    };
  });
}

/** Resolve plaintext credentials for a generation. Prefers the user's own key, falls back to the site key. */
export async function resolveCredentials(supabase: SupabaseClient, engine: EngineManifest): Promise<Record<string, string>> {
  const stored = await loadStored(supabase);
  const row = stored.get(engine.id);
  const out: Record<string, string> = {};
  const required = engine.credentials.filter((f) => f.required);
  const userHasAll = required.length > 0 && required.every((f) => Boolean(row?.config[f.key]));
  if (userHasAll && row) {
    for (const f of engine.credentials) {
      const v = row.config[f.key];
      if (!v) continue;
      out[f.key] = f.secret ? (hasAppSecret() ? decrypt(v) : "") : v;
    }
    return out;
  }
  if (engine.id === "openai" && process.env.OPENAI_API_KEY) return { apiKey: process.env.OPENAI_API_KEY };
  return out;
}

export async function loadDefaults(supabase: SupabaseClient, userId: string): Promise<EngineDefaults> {
  const { data } = await supabase.from("profiles").select("default_engine, default_model, default_voice").eq("id", userId).maybeSingle();
  return {
    engine: (data?.default_engine as string | null) ?? null,
    model: (data?.default_model as string | null) ?? null,
    voice: (data?.default_voice as string | null) ?? null,
  };
}
