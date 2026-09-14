import { getTranslations } from "next-intl/server";
import { HistoryTable } from "@/components/HistoryTable";
import { listGenerations } from "@/lib/generations";
import { requireUser } from "@/lib/supabase/server";

export default async function BookmarksPage() {
  const t = await getTranslations("bookmarks");
  const { supabase } = await requireUser();
  const rows = await listGenerations(supabase, { bookmarkedOnly: true });
  return (
    <div className="pane">
      <div className="row-head"><h2>{t("title")}</h2></div>
      <HistoryTable rows={rows} emptyText={t("empty")} />
    </div>
  );
}
