import { getTranslations } from "next-intl/server";
import { ScriptsTable } from "@/components/ScriptsTable";
import { listScripts } from "@/lib/generations";
import { requireUser } from "@/lib/supabase/server";

export default async function ScriptsPage() {
  const t = await getTranslations("scripts");
  const { supabase } = await requireUser();
  const rows = await listScripts(supabase);
  return (
    <div className="pane">
      <div className="row-head">
        <h2>{t("title")}</h2>
        <span className="hint">{t("hint")}</span>
      </div>
      <ScriptsTable rows={rows} emptyText={t("empty")} />
    </div>
  );
}
