"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/Avatar";
import { PauseIcon, PlayIcon } from "@/components/Icons";
import { TimelinePlayer, computePeaks } from "@/components/editor/engine";
import { saveProject } from "@/lib/actions/projects";
import { fmtDuration } from "@/lib/format";
import { sortedClips, timelineDuration } from "@/lib/timeline";
import type { Clip, ClipSource, Project, Timeline } from "@/lib/types";

type Props = { project: Project; sources: ClipSource[] };

const MIN_CLIP = 0.05;
const SNAP_PX = 7;
const BUCKETS = 100;

type Drag =
  | { kind: "move"; clipId: string; startX: number; origStart: number }
  | { kind: "trim-left"; clipId: string; startX: number; orig: Clip }
  | { kind: "trim-right"; clipId: string; startX: number; orig: Clip };

function fmtClock(s: number): string {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), tenths = Math.floor((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, "0")}.${tenths}`;
}

export function AudioEditor({ project, sources }: Props) {
  const t = useTranslations("editor");
  const playerRef = useRef<TimelinePlayer | null>(null);
  const player = () => (playerRef.current ??= new TimelinePlayer());

  const [timeline, setTimeline] = useState<Timeline>(project.timeline);
  const [title, setTitle] = useState(project.title);
  const [past, setPast] = useState<Timeline[]>([]);
  const [future, setFuture] = useState<Timeline[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pxPerSec, setPxPerSec] = useState(60);
  const [loaded, setLoaded] = useState<Record<string, number>>({});
  const [peaks, setPeaks] = useState<Record<string, Float32Array>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const [tool, setTool] = useState<"select" | "razor">("select");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [addOpen, setAddOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"mp3" | "wav">("mp3");
  const [exported, setExported] = useState<{ url: string; download: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const dirtyRef = useRef(false);
  const tlRef = useRef<Timeline>(project.timeline);
  useEffect(() => { tlRef.current = timeline; }, [timeline]);

  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  const track = timeline.tracks[0];
  const clips = useMemo(() => sortedClips(track.clips), [track.clips]);
  const total = timelineDuration(timeline);
  const widthSec = Math.max(total + 5, 30);
  const selectedClip = clips.find((c) => c.id === selected) ?? null;

  const sourceDuration = useCallback((id: string) => loaded[id] ?? sourceById.get(id)?.duration ?? 0, [loaded, sourceById]);

  // Load every source the timeline references.
  useEffect(() => {
    const ids = new Set(track.clips.map((c) => c.sourceId));
    for (const id of ids) {
      const src = sourceById.get(id);
      if (!src || player().has(id)) continue;
      player().load(src).then((buf) => {
        setLoaded((l) => ({ ...l, [id]: buf.duration }));
        setPeaks((p) => ({ ...p, [id]: computePeaks(buf, BUCKETS) }));
        // Untouched clips carry the source's estimated length; snap them to the decoded length.
        setTimeline((tl) => {
          let changed = false;
          const cs = tl.tracks[0].clips.map((c) => {
            if (c.sourceId !== id) return c;
            const untouched = c.offset === 0 && Math.abs(c.duration - src.duration) < 0.01;
            const maxDur = Math.max(MIN_CLIP, buf.duration - c.offset);
            const next = untouched ? buf.duration : Math.min(c.duration, maxDur);
            if (Math.abs(next - c.duration) < 0.001) return c;
            changed = true;
            return { ...c, duration: next };
          });
          if (!changed) return tl;
          dirtyRef.current = true;
          return { tracks: [{ ...tl.tracks[0], clips: cs }] };
        });
      }).catch(() => setError(t("loadFailed")));
    }
  }, [track.clips, sourceById, t]);

  // Autosave, one second after the last change.
  useEffect(() => {
    if (!dirtyRef.current) return;
    setSaveState("dirty");
    const h = setTimeout(async () => {
      setSaveState("saving");
      const r = await saveProject(project.id, timeline, title);
      setSaveState(r.ok ? "saved" : "error");
      dirtyRef.current = false;
    }, 1000);
    return () => clearTimeout(h);
  }, [timeline, title, project.id]);

  /** Edit the clips of the first track from the latest state, so rapid successive edits never clobber each other. */
  function updateClips(fn: (clips: Clip[]) => Clip[]) {
    const base = tlRef.current;
    const next: Timeline = { tracks: [{ ...base.tracks[0], clips: fn(base.tracks[0].clips) }] };
    tlRef.current = next;
    setPast((p) => [...p.slice(-60), base]);
    setFuture([]);
    dirtyRef.current = true;
    setTimeline(next);
  }
  function undo() { const prev = past.at(-1); if (!prev) return; setPast((p) => p.slice(0, -1)); setFuture((f) => [timeline, ...f]); dirtyRef.current = true; setTimeline(prev); }
  function redo() { const next = future[0]; if (!next) return; setFuture((f) => f.slice(1)); setPast((p) => [...p, timeline]); dirtyRef.current = true; setTimeline(next); }

  // ---- transport
  const stopPlayback = useCallback(() => { player().stop(); cancelAnimationFrame(rafRef.current); setPlaying(false); }, []);
  const startPlayback = useCallback((from: number) => {
    const end = timelineDuration(timeline);
    if (end <= 0) return;
    const start = from >= end ? 0 : from;
    player().play(track.clips, start, end);
    setPlaying(true);
    const tick = () => {
      const pos = player().position();
      setPlayhead(pos);
      if (player().finished()) { player().stop(); setPlaying(false); setPlayhead(end); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [timeline, track.clips]);
  function togglePlay() { if (playing) stopPlayback(); else startPlayback(playhead); }
  function seek(sec: number) { const s = Math.max(0, sec); setPlayhead(s); if (playing) startPlayback(s); }
  useEffect(() => () => { player().stop(); cancelAnimationFrame(rafRef.current); }, []);

  // ---- editing
  function clipAtPlayhead(): Clip | null {
    if (selectedClip && playhead > selectedClip.start && playhead < selectedClip.start + selectedClip.duration) return selectedClip;
    return clips.find((c) => playhead > c.start && playhead < c.start + c.duration) ?? null;
  }
  function splitClipAt(c: Clip, time: number) {
    const at = time - c.start;
    if (at < MIN_CLIP || c.duration - at < MIN_CLIP) return;
    const left: Clip = { ...c, duration: at, fadeOut: 0 };
    const right: Clip = { ...c, id: crypto.randomUUID(), start: c.start + at, offset: c.offset + at, duration: c.duration - at, fadeIn: 0 };
    updateClips((cs) => cs.flatMap((x) => (x.id === c.id ? [left, right] : [x])));
    setSelected(right.id);
  }
  function split() {
    const c = clipAtPlayhead(); if (!c) return;
    splitClipAt(c, playhead);
  }
  function remove() { if (!selectedClip) return; updateClips((cs) => cs.filter((c) => c.id !== selectedClip.id)); setSelected(null); }
  function closeGaps() {
    let cursor = 0;
    updateClips((cs) => sortedClips(cs).map((c) => { const moved = { ...c, start: cursor }; cursor += c.duration; return moved; }));
  }
  function patchSelected(patch: Partial<Clip>) { if (!selectedClip) return; updateClips((cs) => cs.map((c) => (c.id === selectedClip.id ? { ...c, ...patch } : c))); }
  function addSource(src: ClipSource) {
    const duration = Math.max(MIN_CLIP, sourceDuration(src.id) || src.duration || 1);
    const id = crypto.randomUUID();
    updateClips((cs) => {
      const end = cs.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
      return [...cs, { id, sourceId: src.id, start: end, offset: 0, duration, gain: 1, fadeIn: 0, fadeOut: 0 }];
    });
    setSelected(id);
  }

  // ---- drag handling
  function neighbours(clipId: string) {
    const i = clips.findIndex((c) => c.id === clipId);
    const prev = clips[i - 1], next = clips[i + 1];
    return { prevEnd: prev ? prev.start + prev.duration : 0, nextStart: next ? next.start : Infinity };
  }
  function snap(sec: number, own: Clip): number {
    const targets = [0, playhead, ...clips.filter((c) => c.id !== own.id).flatMap((c) => [c.start, c.start + c.duration])];
    for (const tg of targets) if (Math.abs(tg - sec) * pxPerSec < SNAP_PX) return tg;
    return sec;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / pxPerSec;
    const { prevEnd, nextStart } = neighbours(drag.clipId);
    setTimeline((tl) => {
      const cs = tl.tracks[0].clips.map((c) => {
        if (c.id !== drag.clipId) return c;
        if (drag.kind === "move") {
          let start = snap(drag.origStart + dx, c);
          start = Math.min(Math.max(start, prevEnd), Math.max(prevEnd, nextStart - c.duration));
          return { ...c, start: Math.max(0, start) };
        }
        const o = drag.orig;
        const srcDur = sourceDuration(o.sourceId) || o.offset + o.duration;
        if (drag.kind === "trim-left") {
          let delta = dx;
          delta = Math.max(delta, -o.offset, prevEnd - o.start);
          delta = Math.min(delta, o.duration - MIN_CLIP);
          return { ...c, start: o.start + delta, offset: o.offset + delta, duration: o.duration - delta };
        }
        let duration = o.duration + dx;
        duration = Math.min(duration, srcDur - o.offset, nextStart - o.start);
        duration = Math.max(MIN_CLIP, duration);
        return { ...c, duration };
      });
      return { tracks: [{ ...tl.tracks[0], clips: cs }] };
    });
  }
  function beginDrag(d: Drag, e: React.PointerEvent) {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPast((p) => [...p.slice(-60), timeline]); setFuture([]);
    setSelected(d.clipId);
    setDrag(d);
  }
  function endDrag() { if (!drag) return; setDrag(null); dirtyRef.current = true; setTimeline((tl) => ({ ...tl })); }

  // ---- keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      else if (e.key === "s" || e.key === "S") { e.preventDefault(); split(); }
      else if (e.key === "v" || e.key === "V") { setTool("select"); }
      else if (e.key === "c" || e.key === "C") { setTool("razor"); }
      else if (e.key === "Escape") { setTool("select"); setSelected(null); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(); }
      else if (e.key === "Home") { seek(0); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- export
  async function exportMix() {
    setExporting(true); setError(null); setExported(null);
    try {
      const res = await fetch("/api/render", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, timeline, format: exportFormat, title }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("exportFailed"));
      setExported({ url: data.generation.url, download: data.generation.download_url });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  // ---- rendering helpers
  const ruler = useMemo(() => {
    const step = pxPerSec >= 120 ? 1 : pxPerSec >= 50 ? 5 : 10;
    const marks: number[] = [];
    for (let s = 0; s <= widthSec; s += step) marks.push(s);
    return marks;
  }, [pxPerSec, widthSec]);

  return (
    <div className="editor-page" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <div className="editor-head">
        <Link href="/studio" className="chip-btn">← {t("allProjects")}</Link>
        <input className="editor-title" id="project-title" value={title} onChange={(e) => { dirtyRef.current = true; setTitle(e.target.value); }} placeholder={t("untitled")} />
        <span className={`save-state ${saveState}`}>{t(`save.${saveState}`)}</span>
        <span style={{ flex: 1 }} />
        <button className="btn" type="button" onClick={() => setAddOpen((o) => !o)}>{addOpen ? t("closeClips") : t("addClip")}</button>
        <div className="select"><select className="input slim" id="export-format" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as "mp3" | "wav")}><option value="mp3">MP3</option><option value="wav">WAV</option></select></div>
        <button className="btn primary" type="button" onClick={exportMix} disabled={exporting || clips.length === 0}>{exporting ? t("exporting") : t("export")}</button>
      </div>

      {error && <div className="alert">{error}</div>}
      {exported && (
        <div className="notice inline-row">
          <span>{t("exportedNote")}</span>
          <audio controls src={exported.url} style={{ height: 32 }} />
          <a className="chip-btn" href={exported.download} download>{t("download")}</a>
          <Link className="chip-btn" href="/history">{t("openHistory")}</Link>
        </div>
      )}

      <div className="editor-body">
        <div className="editor-main">
          <div className="transport">
            <button className="big" type="button" onClick={togglePlay} disabled={clips.length === 0} aria-label={playing ? t("pause") : t("play")}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
            <button className="chip-btn" type="button" onClick={() => seek(0)}>⏮</button>
            <span className="mono clock"><b>{fmtClock(playhead)}</b> / {fmtClock(total)}</span>
            <span className="tools-sep" />
            <button className="chip-btn" type="button" onClick={closeGaps} disabled={clips.length < 2}>{t("closeGaps")}</button>
            <span className="tools-sep" />
            <button className="chip-btn" type="button" onClick={undo} disabled={past.length === 0} title="⌘Z">{t("undo")}</button>
            <button className="chip-btn" type="button" onClick={redo} disabled={future.length === 0} title="⇧⌘Z">{t("redo")}</button>
            <span style={{ flex: 1 }} />
            <label className="zoom"><span>{t("zoom")}</span><input type="range" min={20} max={300} step={5} value={pxPerSec} onChange={(e) => setPxPerSec(Number(e.target.value))} /></label>
          </div>

          <div className="tl-area">
            <div className="tool-rail" role="toolbar" aria-label={t("tools")}>
              <button type="button" className={tool === "select" ? "on" : ""} onClick={() => setTool("select")} title={`${t("toolSelect")} (V)`} aria-label={t("toolSelect")}>
                <svg viewBox="0 0 24 24"><path d="M5 3l14 9-6 1.5L16 20l-3 1.5-3-6.5L5 19z" /></svg>
              </button>
              <button type="button" className={tool === "razor" ? "on" : ""} onClick={() => setTool("razor")} title={`${t("toolRazor")} (C)`} aria-label={t("toolRazor")}>
                <svg viewBox="0 0 24 24"><g transform="rotate(-45 12 12)"><rect x="2.5" y="8" width="19" height="8" rx="1.5" /><path d="M9.5 12h5" /><path d="M12 8v1.5M12 14.5V16" /><path d="M5.5 8v1M5.5 15v1M18.5 8v1M18.5 15v1" /></g></svg>
              </button>
              <span className="rail-sep" />
              <button type="button" className="danger" onClick={remove} disabled={!selectedClip} title={`${t("deleteClip")} (Delete)`} aria-label={t("deleteClip")}>
                <svg viewBox="0 0 24 24"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></svg>
              </button>
              <button type="button" onClick={split} disabled={!clipAtPlayhead()} title={`${t("splitAtPlayhead")} (S)`} aria-label={t("splitAtPlayhead")}>
                <svg viewBox="0 0 24 24"><path d="M12 3v18" strokeDasharray="3 3" /><path d="M5 8h4M5 16h4M15 8h4M15 16h4" /></svg>
              </button>
            </div>
          <div className="tl-scroll" ref={scrollRef}>
            <div className="tl" style={{ width: widthSec * pxPerSec }}>
              <div className="ruler" onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / pxPerSec); }}>
                {ruler.map((s) => (
                  <span key={s} className="tick" style={{ left: s * pxPerSec }}><i />{fmtDuration(s)}</span>
                ))}
              </div>
              <div className={`track ${tool === "razor" ? "razor" : ""}`} onPointerDown={(e) => { if (e.target !== e.currentTarget) return; const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / pxPerSec); setSelected(null); }}>
                {clips.length === 0 && <div className="track-empty">{t("emptyTrack")}</div>}
                {clips.map((c) => {
                  const src = sourceById.get(c.sourceId);
                  const pk = peaks[c.sourceId];
                  return (
                    <div
                      key={c.id}
                      className={`clip ${selected === c.id ? "selected" : ""} ${pk ? "" : "loading"}`}
                      style={{ left: c.start * pxPerSec, width: Math.max(4, c.duration * pxPerSec) }}
                      onPointerDown={(e) => {
                        if (tool === "razor") {
                          e.preventDefault(); e.stopPropagation();
                          const r = e.currentTarget.getBoundingClientRect();
                          splitClipAt(c, c.start + (e.clientX - r.left) / pxPerSec);
                          return;
                        }
                        beginDrag({ kind: "move", clipId: c.id, startX: e.clientX, origStart: c.start }, e);
                      }}
                      title={src?.label}
                    >
                      <Waveform peaks={pk} clip={c} pxPerSec={pxPerSec} />
                      <span className="clip-label">{src ? <Avatar voice={src.voice} size="xs" /> : null}<span>{src?.label ?? t("missingSource")}</span></span>
                      {c.fadeIn > 0 && <i className="fade in" style={{ width: c.fadeIn * pxPerSec }} />}
                      {c.fadeOut > 0 && <i className="fade out" style={{ width: c.fadeOut * pxPerSec }} />}
                      <span className="handle l" onPointerDown={(e) => beginDrag({ kind: "trim-left", clipId: c.id, startX: e.clientX, orig: c }, e)} />
                      <span className="handle r" onPointerDown={(e) => beginDrag({ kind: "trim-right", clipId: c.id, startX: e.clientX, orig: c }, e)} />
                    </div>
                  );
                })}
              </div>
              <div className="playhead" style={{ left: playhead * pxPerSec }} />
            </div>
          </div>
          </div>

          <div className="inspector">
            {selectedClip ? (
              <>
                <span className="insp-name"><Avatar voice={sourceById.get(selectedClip.sourceId)?.voice ?? "alloy"} size="xs" />{sourceById.get(selectedClip.sourceId)?.label ?? t("missingSource")}</span>
                <label><span>{t("volume")}</span><input type="range" min={0} max={2} step={0.05} value={selectedClip.gain} onChange={(e) => patchSelected({ gain: Number(e.target.value) })} /><b className="mono">{Math.round(selectedClip.gain * 100)}%</b></label>
                <label><span>{t("fadeIn")}</span><input className="input slim num" type="number" min={0} max={Math.max(0, selectedClip.duration)} step={0.1} value={selectedClip.fadeIn} onChange={(e) => patchSelected({ fadeIn: Math.max(0, Math.min(selectedClip.duration, Number(e.target.value))) })} /><span className="mono">s</span></label>
                <label><span>{t("fadeOut")}</span><input className="input slim num" type="number" min={0} max={Math.max(0, selectedClip.duration)} step={0.1} value={selectedClip.fadeOut} onChange={(e) => patchSelected({ fadeOut: Math.max(0, Math.min(selectedClip.duration, Number(e.target.value))) })} /><span className="mono">s</span></label>
                <span className="mono muted">{fmtClock(selectedClip.start)} → {fmtClock(selectedClip.start + selectedClip.duration)}</span>
              </>
            ) : (
              <span className="hint">{t("inspectorHint")}</span>
            )}
          </div>
        </div>

        {addOpen && (
          <aside className="clip-bin">
            <h4>{t("yourClips")}</h4>
            {sources.length === 0 && <p className="hint">{t("noSources")}</p>}
            {sources.map((s) => (
              <div key={s.id} className="bin-item">
                <Avatar voice={s.voice} size="xs" />
                <span className="bin-label" title={s.label}>{s.label}</span>
                <span className="mono muted">{fmtDuration(s.duration)}</span>
                <button className="mini" type="button" onClick={() => player().preview(s)} aria-label={t("preview")}><PlayIcon /></button>
                <button className="chip-btn primary" type="button" onClick={() => addSource(s)}>{t("add")}</button>
              </div>
            ))}
          </aside>
        )}
      </div>

      <p className="hint shortcuts">{t("shortcuts")}</p>
    </div>
  );
}

function Waveform({ peaks, clip, pxPerSec }: { peaks?: Float32Array; clip: Clip; pxPerSec: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const w = Math.max(1, Math.round(clip.duration * pxPerSec)), h = 56;
    canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, w, h);
    if (!peaks) return;
    ctx.fillStyle = getComputedStyle(canvas).color;
    const mid = h / 2;
    for (let x = 0; x < w; x++) {
      const tSec = clip.offset + x / pxPerSec;
      const i = Math.floor(tSec * BUCKETS);
      const v = i < peaks.length ? peaks[i] : 0;
      const bar = Math.max(1, v * (h - 6) * clip.gain);
      ctx.fillRect(x, mid - bar / 2, 1, bar);
    }
  }, [peaks, clip.offset, clip.duration, clip.gain, pxPerSec]);
  return <canvas ref={ref} className="wave-canvas" style={{ width: Math.max(1, clip.duration * pxPerSec), height: 56 }} />;
}
