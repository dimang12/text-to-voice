import { Studio } from "@/components/Studio";
import { getScript, listGenerations, listPresets } from "@/lib/generations";
import { requireUser } from "@/lib/supabase/server";

export default async function StudioPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const scriptId = typeof params.script === "string" ? params.script : null;
  const { supabase } = await requireUser();
  const [presets, recent, script] = await Promise.all([
    listPresets(supabase),
    listGenerations(supabase, { limit: 1 }),
    scriptId ? getScript(supabase, scriptId) : Promise.resolve(null),
  ]);
  return <Studio key={script?.id ?? "new"} presets={presets} initial={recent[0] ?? null} script={script} />;
}
