import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { fmtDuration } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

export async function Sidebar({ stats, name }: { stats: DashboardStats; name: string }) {
  const t = await getTranslations();
  const pct = Math.min(100, Math.round((stats.month_chars / Math.max(1, stats.quota)) * 100));
  const hours = Math.floor(stats.seconds / 3600);
  const audioMade = hours > 0 ? `${hours}h ${Math.floor((stats.seconds % 3600) / 60)}m` : fmtDuration(stats.seconds);

  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <div className="orb" />
        <div>
          <b>{t("app.name")}</b>
          <span>{t("app.workspace", { name })}</span>
        </div>
      </Link>

      <div className="stats">
        <div className="stat"><b className="mono">{stats.generations}</b><small>{t("stats.generations")}</small></div>
        <div className="stat"><b className="mono">{audioMade}</b><small>{t("stats.audioMade")}</small></div>
        <div className="stat"><b className="mono">{stats.scripts}</b><small>{t("stats.scripts")}</small></div>
        <div className="stat"><b className="mono">{stats.presets}</b><small>{t("stats.presets")}</small></div>
      </div>

      <div className="usage">
        <div className="usage-row">
          <span>{t("stats.charsThisMonth")}</span>
          <b className="mono">{stats.month_chars.toLocaleString()} / {Math.round(stats.quota / 1000)}k</b>
        </div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="section-label">{t("nav.quickLinks")}</div>
      <nav className="nav">
        <Link href="/scripts" title={t("nav.scripts")}>
          <svg viewBox="0 0 24 24"><path d="M6 3h9l5 5v13H6z" /><path d="M14 3v6h6" /><path d="M9 13h6M9 17h6" /></svg>
          <span>{t("nav.scripts")}</span>
        </Link>
        <Link href="/history" title={t("nav.history")}>
          <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" /></svg>
          <span>{t("nav.history")}</span>
        </Link>
        <Link href="/bookmarks" title={t("nav.bookmarks")}>
          <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
          <span>{t("nav.bookmarks")}</span>
        </Link>
        <Link href="/voices" title={t("nav.voices")}>
          <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>
          <span>{t("nav.voices")}</span>
        </Link>
      </nav>
    </aside>
  );
}
