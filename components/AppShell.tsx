"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LangSwitch } from "@/components/LangSwitch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/app/(auth)/actions";

type Props = {
  sidebar: ReactNode;
  tabs: ReactNode;
  locale: string;
  user: { email: string; name: string };
  children: ReactNode;
};

function readCollapsed() {
  try { return localStorage.getItem("sidebar") === "collapsed"; } catch { return false; }
}
function subscribe(cb: () => void) {
  window.addEventListener("sidebar-change", cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener("sidebar-change", cb); window.removeEventListener("storage", cb); };
}

export function AppShell({ sidebar, tabs, locale, user, children }: Props) {
  const t = useTranslations("topbar");
  const tn = useTranslations("nav");
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  function toggle() {
    try { localStorage.setItem("sidebar", collapsed ? "open" : "collapsed"); } catch {}
    window.dispatchEvent(new Event("sidebar-change"));
  }

  return (
    <div className={`frame ${collapsed ? "collapsed" : ""}`}>
      {sidebar}
      <section className="main">
        <div className="topbar">
          <button className="icon-btn" type="button" onClick={toggle} aria-label={t("toggleSidebar")}>
            <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <label className="search">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input id="search" placeholder={t("search")} />
          </label>
          <LangSwitch locale={locale} />
          <ThemeToggle />
          <div className="user-chip" title={user.email}>
            <span className="initial">{(user.name || user.email)[0]?.toUpperCase()}</span>
            <span>{user.name || user.email}</span>
            <form action={signOut}><button type="submit">{tn("signOut")}</button></form>
          </div>
        </div>
        <div className="workspace">
          {tabs}
          {children}
        </div>
      </section>
    </div>
  );
}
