import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { SetupNotice } from "@/components/SetupNotice";
import { Sidebar } from "@/components/Sidebar";
import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import { hasSupabaseEnv } from "@/lib/env";
import { dashboardStats } from "@/lib/generations";
import { requireUser } from "@/lib/supabase/server";
import { VOICES } from "@/lib/tts";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!hasSupabaseEnv()) return <SetupNotice />;
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");

  const [locale, stats, { data: profile }] = await Promise.all([
    getLocale(),
    dashboardStats(supabase),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  const name = (profile?.display_name as string | null) || user.user_metadata?.display_name || user.email?.split("@")[0] || "";

  return (
    <AppShell
      locale={locale}
      user={{ email: user.email ?? "", name }}
      sidebar={<Sidebar stats={stats} name={name} />}
      tabs={<WorkspaceTabs counts={{ history: stats.generations, voices: VOICES.length, bookmarks: stats.bookmarks, scripts: stats.scripts }} />}
    >
      {children}
    </AppShell>
  );
}
