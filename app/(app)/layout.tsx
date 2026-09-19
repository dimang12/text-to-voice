import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { SetupNotice } from "@/components/SetupNotice";
import { Sidebar } from "@/components/Sidebar";
import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import { hasSupabaseEnv } from "@/lib/env";
import { dashboardStats } from "@/lib/generations";
import { requireUser } from "@/lib/supabase/server";
import { VOICE_COUNT } from "@/lib/engines/catalog";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!hasSupabaseEnv()) return <SetupNotice />;
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");

  const [locale, stats, { data: profile }, { count: projectCount }] = await Promise.all([
    getLocale(),
    dashboardStats(supabase),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("projects").select("id", { count: "exact", head: true }),
  ]);
  const meta = user.user_metadata ?? {};
  const name = (profile?.display_name as string | null) || meta.display_name || meta.full_name || meta.name || user.email?.split("@")[0] || "";

  return (
    <AppShell
      locale={locale}
      user={{ email: user.email ?? "", name }}
      sidebar={<Sidebar stats={stats} name={name} />}
      tabs={<WorkspaceTabs counts={{ history: stats.generations, voices: VOICE_COUNT, bookmarks: stats.bookmarks, scripts: stats.scripts, projects: projectCount ?? 0 }} />}
    >
      {children}
    </AppShell>
  );
}
