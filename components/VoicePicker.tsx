"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/Avatar";
import { PauseIcon, PlayIcon } from "@/components/Icons";
import type { VoiceSpec } from "@/lib/engines/types";

type Props = { engine: string; voices: VoiceSpec[]; value: string; onChange: (v: string) => void };

export function VoicePicker({ engine, voices, value, onChange }: Props) {
  const t = useTranslations("voices");
  const [busy, setBusy] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(null);
  }

  async function preview(voice: string) {
    if (playing === voice) { stop(); return; }
    if (busy) return;
    stop();
    setBusy(voice);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true, engine, voice, text: t("previewText") }),
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
        <button key={v.id} type="button" className={`voice ${v.id === value ? "selected" : ""}`} onClick={() => onChange(v.id)}>
          <span className={`avatar-wrap ${busy === v.id ? "loading" : ""} ${playing === v.id ? "playing" : ""}`}>
            <Avatar voice={v.id} />
            <span
              role="button"
              tabIndex={0}
              aria-label={t("preview", { voice: v.name })}
              className={`play ${busy === v.id || playing === v.id ? "on" : ""}`}
              onClick={(e) => { e.stopPropagation(); preview(v.id); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); preview(v.id); } }}
            >
              {playing === v.id ? <PauseIcon /> : <PlayIcon />}
            </span>
          </span>
          <span className="voice-name">{v.name}</span>
          <span className="voice-tag">{t(v.tagKey)}</span>
        </button>
      ))}
    </div>
  );
}
