"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteProject } from "@/lib/actions/projects";
import { fmtDate, fmtDuration } from "@/lib/format";
import type { Project } from "@/lib/types";

export function ProjectsTable({ rows, emptyText }: { rows: Project[]; emptyText: string }) {
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toDelete, setToDelete] = useState<Project | null>(null);

  if (rows.length === 0) return <div className="empty">{emptyText}</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>{t("project")}</th><th>{t("clips")}</th><th>{t("length")}</th><th>{t("updated")}</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => {
            const count = r.timeline.tracks.reduce((n, tr) => n + tr.clips.length, 0);
            return (
              <tr key={r.id}>
                <td><Link href={`/studio/${r.id}`} style={{ textDecoration: "none", fontWeight: 700 }}>{r.title}</Link></td>
                <td className="mono">{count}</td>
                <td className="mono">{fmtDuration(r.duration_seconds)}</td>
                <td className="muted">{fmtDate(r.updated_at, locale)}</td>
                <td>
                  <span className="row-actions">
                    <Link className="chip-btn" href={`/studio/${r.id}`}>{t("open")}</Link>
                    <button className="chip-btn danger" type="button" onClick={() => setToDelete(r)}>{tc("delete")}</button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ConfirmDialog open={toDelete !== null} title={t("deleteTitle")} body={t("deleteBody")} confirmLabel={tc("delete")} cancelLabel={tc("cancel")} danger busy={pending}
        onConfirm={() => { const p = toDelete; if (!p) return; start(async () => { await deleteProject(p.id); setToDelete(null); router.refresh(); }); }}
        onCancel={() => setToDelete(null)} />
    </div>
  );
}
