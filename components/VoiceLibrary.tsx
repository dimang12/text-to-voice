"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/Avatar";
import { PauseIcon, PlayIcon, SpinnerIcon } from "@/components/Icons";
import type { EngineView } from "@/lib/engines/types";

export function VoiceLibrary({ engines }: { engines: EngineView[] }) {
  const t = useTranslations("voices");
  const te = useTranslations("engines");
  const [playing, setPlaying] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function preview(engine: string, voice: string) {
    if (playing === voice) { audioRef.current?.pause(); setPlaying(null); return; }
    if (busy) return;
    setBusy(voice);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true, engine, voice, text: t("previewText") }),
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setPlaying(null); URL.revokeObjectURL(url); };
      await audio.play();
      setPlaying(voice);
    } catch {
      setPlaying(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="section-gap" style={{ gap: 22 }}>
      {engines.map((engine) => (
        <div key={engine.id} className="section-gap">
          <div className="row-head">
            <h2>{te(engine.nameKey)}</h2>
            <span className={`pill ${engine.status.available ? "" : "muted-pill"}`}>{engine.status.available ? t("ready") : t("notSetUp")}</span>
          </div>
          <div className="voice-cards">
            {engine.voices.map((v) => (
              <div className="vcard" key={v.id}>
                <span className={`avatar-wrap ${busy === v.id ? "loading" : ""} ${playing === v.id ? "playing" : ""}`}><Avatar voice={v.id} size="sm" /></span>
                <div><b>{v.name}</b><span>{t(v.tagKey)}</span></div>
                <button className={`mini ${playing === v.id ? "on" : ""} ${busy === v.id ? "loading" : ""}`} type="button" aria-label={t("preview", { voice: v.name })}
                  onClick={() => preview(engine.id, v.id)} disabled={!engine.status.available || (busy !== null && busy !== v.id)}>
                  {busy === v.id ? <SpinnerIcon /> : playing === v.id ? <PauseIcon /> : <PlayIcon />}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
