"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/Avatar";
import { deleteScript } from "@/lib/actions/scripts";
import { fmtDate } from "@/lib/format";
import type { SavedScript } from "@/lib/types";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function ScriptsTable({ rows, emptyText }: { rows: SavedScript[]; emptyText: string }) {
  const t = useTranslations("scripts");
  const locale = useLocale();
  const router = useRouter();
  const [, start] = useTransition();

  if (rows.length === 0) return <div className="empty">{emptyText}</div>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{t("script")}</th>
            <th>{t("voice")}</th>
            <th>{t("length")}</th>
            <th>{t("updated")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/?script=${r.id}`} style={{ textDecoration: "none" }}>
                  <b style={{ display: "block" }}>{r.title}</b>
                  <span className="snippet" style={{ display: "block", color: "var(--muted)", fontSize: 12 }}>{r.body}</span>
                </Link>
              </td>
              <td><span className="pill"><Avatar voice={r.voice} size="xs" />{cap(r.voice)}</span></td>
              <td className="mono muted">{r.body.length.toLocaleString()}</td>
              <td className="muted">{fmtDate(r.updated_at, locale)}</td>
              <td>
                <span className="row-actions">
                  <Link className="chip-btn" href={`/?script=${r.id}`}>{t("open")}</Link>
                  <button className="chip-btn danger" type="button"
                    onClick={() => { if (confirm(t("confirmDelete"))) start(async () => { await deleteScript(r.id); router.refresh(); }); }}>
                    {t("delete")}
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
