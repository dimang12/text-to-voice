"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/Avatar";
import { PauseIcon, PlayIcon } from "@/components/Icons";
import { voicesFor, type Model, type Voice } from "@/lib/tts";

type Props = { value: Voice; model: Model; onChange: (v: Voice) => void };

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function VoicePicker({ value, model, onChange }: Props) {
  const voices = voicesFor(model);
  const t = useTranslations("voices");
  const [busy, setBusy] = useState<Voice | null>(null);
  const [playing, setPlaying] = useState<Voice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(null);
  }

  async function preview(voice: Voice) {
    if (playing === voice) { stop(); return; }
    if (busy) return;
    stop();
    setBusy(voice);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true, voice, text: t("previewText") }),
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setPlaying((p) => (p === voice ? null : p)); };
      await audio.play();
      setPlaying(voice);
    } catch {
      setPlaying(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="voices">
      {voices.map((v) => (
        <button
          key={v}
          type="button"
          className={`voice ${v === value ? "selected" : ""}`}
          onClick={() => onChange(v)}
        >
          <span className={`avatar-wrap ${busy === v ? "loading" : ""} ${playing === v ? "playing" : ""}`}>
            <Avatar voice={v} />
            <span
              role="button"
              tabIndex={0}
              aria-label={t("preview", { voice: cap(v) })}
              className={`play ${busy === v || playing === v ? "on" : ""}`}
              onClick={(e) => { e.stopPropagation(); preview(v); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); preview(v); } }}
            >
              {playing === v ? <PauseIcon /> : <PlayIcon />}
            </span>
          </span>
          <span className="voice-name">{cap(v)}</span>
          <span className="voice-tag">{t(v)}</span>
        </button>
      ))}
    </div>
  );
}
