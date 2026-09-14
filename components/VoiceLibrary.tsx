"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/Avatar";
import { PauseIcon, PlayIcon, SpinnerIcon } from "@/components/Icons";
import { VOICES, type Voice } from "@/lib/tts";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function VoiceLibrary() {
  const t = useTranslations("voices");
  const [playing, setPlaying] = useState<Voice | null>(null);
  const [busy, setBusy] = useState<Voice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function preview(voice: Voice) {
    if (playing === voice) { audioRef.current?.pause(); setPlaying(null); return; }
    if (busy) return;
    setBusy(voice);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true, voice, text: t("previewText") }),
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
    <div className="voice-cards">
      {VOICES.map((v) => (
        <div className="vcard" key={v}>
          <span className={`avatar-wrap ${busy === v ? "loading" : ""} ${playing === v ? "playing" : ""}`}><Avatar voice={v} size="sm" /></span>
          <div><b>{cap(v)}</b><span>{t(v)}</span></div>
          <button className={`mini ${playing === v ? "on" : ""} ${busy === v ? "loading" : ""}`} type="button" aria-label={t("preview", { voice: cap(v) })} onClick={() => preview(v)} disabled={busy !== null && busy !== v}>
            {busy === v ? <SpinnerIcon /> : playing === v ? <PauseIcon /> : <PlayIcon />}
          </button>
        </div>
      ))}
    </div>
  );
}
