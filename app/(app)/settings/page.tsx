import { getTranslations } from "next-intl/server";
import { EngineSettings } from "@/components/EngineSettings";
import { hasAppSecret } from "@/lib/crypto";
import { listEngineViews, loadDefaults } from "@/lib/engine-settings";
import { requireUser } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const { supabase, user } = await requireUser();
  const [engines, defaults] = await Promise.all([listEngineViews(supabase), loadDefaults(supabase, user!.id)]);
  return (
    <div className="pane">
      <div className="row-head">
        <h2>{t("title")}</h2>
        <span className="hint">{t("hint")}</span>
      </div>
      <EngineSettings engines={engines} defaults={defaults} secretsEnabled={hasAppSecret()} />
    </div>
  );
}
