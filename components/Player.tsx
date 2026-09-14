"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PauseIcon, PlayIcon } from "@/components/Icons";
import { fmtBytes, fmtDuration } from "@/lib/format";
import type { GenerationWithUrl } from "@/lib/types";

type Props = {
  generation: GenerationWithUrl | null;
  loading: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
};

const BAR_COUNT = 120;

function makeBars(key: string): number[] {
  let seed = key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  return Array.from({ length: BAR_COUNT }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11)) * (0.6 + 0.4 * rand()));
}

export function Player({ generation, loading, canGenerate, onGenerate }: Props) {
  const t = useTranslations("studio");
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(generation?.duration_seconds ?? 0);
  const [prevId, setPrevId] = useState(generation?.id);

  // Reset playback state when a different clip arrives.
  if (prevId !== generation?.id) {
    setPrevId(generation?.id);
    setPlaying(false);
    setTime(0);
    setDuration(generation?.duration_seconds ?? 0);
  }

  // Deterministic decorative bars per clip.
  const bars = useMemo(() => makeBars(generation?.id ?? "seed"), [generation?.id]);

  // Siri-style flowing waves while a generation is in flight.
  useEffect(() => {
    if (!loading) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    const layers = [
      { color: accent, freq: 1.6, speed: 2.1, amp: 0.55, width: 2.2 },
      { color: "#6ee7ff", freq: 2.3, speed: -1.7, amp: 0.42, width: 1.8 },
      { color: "#ff7ad9", freq: 1.1, speed: 1.3, amp: 0.36, width: 1.6 },
    ];
    const W = canvas.width, H = canvas.height, mid = H / 2;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const breathe = 0.75 + 0.25 * Math.sin(t * 1.4);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = "round";
      layers.forEach((l, li) => {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
          const u = (x / W) * 2 - 1;
          const envelope = Math.pow(1 - u * u, 2);
          const y = mid + Math.sin((x / W) * Math.PI * 2 * l.freq + t * l.speed + li) * l.amp * mid * envelope * breathe;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = l.color;
        ctx.lineWidth = l.width;
        ctx.globalAlpha = 0.9;
        ctx.stroke();
        ctx.lineTo(W, mid); ctx.lineTo(0, mid); ctx.closePath();
        ctx.fillStyle = l.color;
        ctx.globalAlpha = 0.08;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue("--accent").trim();
    const faint = cs.getPropertyValue("--faint").trim();
    const W = canvas.width, H = canvas.height, gap = W / BAR_COUNT;
    const progress = duration > 0 ? time / duration : 0;
    ctx.clearRect(0, 0, W, H);
    bars.forEach((b, i) => {
      const h = b * H * 0.9, x = i * gap;
      ctx.fillStyle = generation && i / BAR_COUNT < progress ? accent : faint;
      ctx.globalAlpha = generation ? 1 : 0.4;
      ctx.beginPath(); ctx.roundRect(x + 1, (H - h) / 2, gap - 3, h, 2); ctx.fill();
    });
  }, [time, duration, generation, playing, bars, loading]);

  function toggle() {
    const a = audioRef.current; if (!a || !generation?.url) return;
    if (a.paused) a.play(); else a.pause();
  }
  function seek(e: React.MouseEvent<HTMLCanvasElement>) {
    const a = audioRef.current; if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  const meta = generation
    ? `${generation.voice} · ${generation.model} · ${generation.format.toUpperCase()} · ${fmtBytes(generation.byte_size)}`
    : t("nothingYet");

  return (
    <div className="player">
      <audio
        ref={audioRef}
        src={generation?.url ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { if (isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); }}
        preload="metadata"
      />
      <button className="big" type="button" onClick={toggle} disabled={!generation?.url} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="wave">
        <canvas ref={canvasRef} width={900} height={80} onClick={seek} className={loading ? "thinking" : ""} />
        <div className="wave-meta mono">
          <span><b>{fmtDuration(time)}</b> / {fmtDuration(duration)}</span>
          <span>{meta}</span>
        </div>
      </div>
      <div className="actions">
        <a className="btn" href={generation?.download_url ?? "#"} aria-disabled={!generation?.download_url} download>
          <svg viewBox="0 0 24 24"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></svg>
          {t("download")}
        </a>
        <button className="btn primary" type="button" onClick={onGenerate} disabled={!canGenerate || loading}>
          <svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>
          {loading ? t("generating") : t("generate")}
        </button>
      </div>
    </div>
  );
}
