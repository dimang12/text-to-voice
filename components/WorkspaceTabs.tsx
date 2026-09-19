"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type Props = { counts: { history: number; voices: number; bookmarks: number; scripts: number; projects: number } };

export function WorkspaceTabs({ counts }: Props) {
  const t = useTranslations("tabs");
  const path = usePathname();
  const tabs = [
    { href: "/", label: t("studio"), count: null },
    { href: "/studio", label: t("editor"), count: counts.projects },
    { href: "/scripts", label: t("scripts"), count: counts.scripts },
    { href: "/history", label: t("history"), count: counts.history },
    { href: "/voices", label: t("voices"), count: counts.voices },
    { href: "/bookmarks", label: t("bookmarked"), count: counts.bookmarks },
  ] as const;
  return (
    <nav className="tabs" role="tablist">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={`tab ${path === tab.href || (tab.href !== "/" && path.startsWith(tab.href + "/")) ? "active" : ""}`} role="tab" aria-selected={path === tab.href}>
          {tab.label}
          {tab.count !== null && <span className="count">{tab.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
