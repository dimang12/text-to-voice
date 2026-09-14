import { getTranslations } from "next-intl/server";

export async function SetupNotice() {
  const t = await getTranslations("setup");
  return (
    <div className="setup">
      <div className="brand">
        <div className="orb" />
        <div><b>Voice Studio</b></div>
      </div>
      <h1 style={{ margin: 0, fontSize: 22 }}>{t("title")}</h1>
      <p style={{ margin: 0, color: "var(--muted)" }}>{t("body")}</p>
      <pre>{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-...`}</pre>
    </div>
  );
}
