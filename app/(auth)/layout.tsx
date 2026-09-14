import { hasSupabaseEnv } from "@/lib/env";
import { LangSwitch } from "@/components/LangSwitch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SetupNotice } from "@/components/SetupNotice";
import { getLocale } from "next-intl/server";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (!hasSupabaseEnv()) return <SetupNotice />;
  const locale = await getLocale();
  return (
    <div className="auth-page">
      <div className="auth-top">
        <LangSwitch locale={locale} />
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
