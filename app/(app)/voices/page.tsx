import { getTranslations } from "next-intl/server";
import { VoiceLibrary } from "@/components/VoiceLibrary";

export default async function VoicesPage() {
  const t = await getTranslations("voicesPage");
  return (
    <div className="pane">
      <div className="row-head">
        <h2>{t("title")}</h2>
        <span className="hint">{t("hint")}</span>
      </div>
      <VoiceLibrary />
    </div>
  );
}
