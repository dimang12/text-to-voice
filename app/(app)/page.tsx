import { Studio } from "@/components/Studio";
import { listEngineViews, loadDefaults } from "@/lib/engine-settings";
import { getScript, listGenerations, listPresets } from "@/lib/generations";
import { requireUser } from "@/lib/supabase/server";

export default async function StudioPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const scriptId = typeof params.script === "string" ? params.script : null;
  const { supabase, user } = await requireUser();
  const [presets, recent, script, engines, defaults] = await Promise.all([
    listPresets(supabase),
    listGenerations(supabase, { limit: 1 }),
    scriptId ? getScript(supabase, scriptId) : Promise.resolve(null),
    listEngineViews(supabase),
    loadDefaults(supabase, user!.id),
  ]);
  return <Studio key={script?.id ?? "new"} presets={presets} initial={recent[0] ?? null} script={script} engines={engines} defaults={defaults} />;
}
