import { getTranslations } from "next-intl/server";
import { HistoryTable } from "@/components/HistoryTable";
import { listGenerations } from "@/lib/generations";
import { requireUser } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const t = await getTranslations("history");
  const { supabase } = await requireUser();
  const rows = await listGenerations(supabase);
  return (
    <div className="pane">
      <div className="row-head">
        <h2>{t("title")}</h2>
        <div className="status"><span className="dot" />{t("kept")}</div>
      </div>
      <HistoryTable rows={rows} emptyText={t("empty")} />
    </div>
  );
}
