import { getTranslations } from "next-intl/server";
import { VoiceLibrary } from "@/components/VoiceLibrary";
import { listEngineViews } from "@/lib/engine-settings";
import { requireUser } from "@/lib/supabase/server";

export default async function VoicesPage() {
  const t = await getTranslations("voicesPage");
  const { supabase } = await requireUser();
  const engines = await listEngineViews(supabase);
  return (
    <div className="pane">
      <div className="row-head">
        <h2>{t("title")}</h2>
        <span className="hint">{t("hint")}</span>
      </div>
      <VoiceLibrary engines={engines} />
    </div>
  );
}
