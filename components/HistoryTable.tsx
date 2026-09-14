"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/Avatar";
import { PauseIcon, PlayIcon } from "@/components/Icons";
import { deleteGeneration, toggleBookmark } from "@/lib/actions/library";
import { fmtBytes, fmtDate, fmtDuration } from "@/lib/format";
import type { GenerationWithUrl } from "@/lib/types";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function HistoryTable({ rows, emptyText }: { rows: GenerationWithUrl[]; emptyText: string }) {
  const t = useTranslations("history");
  const locale = useLocale();
  const router = useRouter();
  const [, start] = useTransition();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  function play(row: GenerationWithUrl) {
    const a = audioRef.current; if (!a || !row.url) return;
    if (playingId === row.id) { a.pause(); setPlayingId(null); return; }
    a.src = row.url; a.play(); setPlayingId(row.id);
  }

  if (rows.length === 0) return <div className="empty">{emptyText}</div>;

  return (
    <div className="table-wrap">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
      <table className="table">
        <thead>
          <tr>
            <th />
            <th>{t("script")}</th>
            <th>{t("voice")}</th>
            <th>{t("model")}</th>
            <th>{t("length")}</th>
            <th>{t("size")}</th>
            <th>{t("created")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <button className="mini" type="button" onClick={() => play(r)} aria-label={t("play")} disabled={!r.url}>
                  {playingId === r.id ? <PauseIcon /> : <PlayIcon />}
                </button>
              </td>
              <td className="snippet" title={r.script}>{r.script}</td>
              <td><span className="pill"><Avatar voice={r.voice} size="xs" />{cap(r.voice)}</span></td>
              <td className="mono muted">{r.model}</td>
              <td className="mono">{fmtDuration(r.duration_seconds)}</td>
              <td className="mono">{fmtBytes(r.byte_size)}</td>
              <td className="muted">{fmtDate(r.created_at, locale)}</td>
              <td>
                <span className="row-actions">
                  <button className={`mini icon ${r.bookmarked ? "on" : ""}`} type="button" aria-label={r.bookmarked ? t("unbookmark") : t("bookmark")}
                    onClick={() => start(async () => { await toggleBookmark(r.id); router.refresh(); })}>
                    <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
                  </button>
                  <a className="mini icon" href={r.download_url ?? "#"} aria-label={t("play")} download>
                    <svg viewBox="0 0 24 24"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></svg>
                  </a>
                  <button className="mini icon" type="button" aria-label={t("delete")}
                    onClick={() => { if (confirm(t("confirmDelete"))) start(async () => { await deleteGeneration(r.id); router.refresh(); }); }}>
                    <svg viewBox="0 0 24 24"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></svg>
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
