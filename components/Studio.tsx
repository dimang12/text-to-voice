"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/Avatar";
import { Player } from "@/components/Player";
import { VoicePicker } from "@/components/VoicePicker";
import { deletePreset, savePreset } from "@/lib/actions/library";
import { saveScript } from "@/lib/actions/scripts";
import { engineForModel } from "@/lib/engines/catalog";
import type { EngineView } from "@/lib/engines/types";
import type { EngineDefaults } from "@/lib/engine-settings";
import { estimateSeconds, fmtDuration } from "@/lib/format";
import type { Format } from "@/lib/tts";
import type { GenerationWithUrl, Preset, SavedScript } from "@/lib/types";

type Props = {
  presets: Preset[];
  initial: GenerationWithUrl | null;
  script: SavedScript | null;
  engines: EngineView[];
  defaults: EngineDefaults;
};

const BUILT_IN = ["narrator", "bedtime", "radio", "news", "casual", "whisper"] as const;

/** Pick the engine, model and voice the Studio should open with, honouring what is actually usable. */
function initialSelection(engines: EngineView[], defaults: EngineDefaults, seedModel?: string, seedVoice?: string) {
  const usable = engines.filter((e) => e.status.available && e.status.enabled);
  const fromSeed = seedModel ? engineForModel(seedModel) : undefined;
  const wanted = (fromSeed && usable.find((e) => e.id === fromSeed.id)) || usable.find((e) => e.id === defaults.engine) || usable[0] || engines[0];
  if (!wanted) return { engine: "", model: "", voice: "" };
  const model = [seedModel, defaults.model].find((m) => m && wanted.models.some((x) => x.id === m)) ?? wanted.models[0].id;
  const voice = [seedVoice, defaults.voice].find((v) => v && wanted.voices.some((x) => x.id === v)) ?? wanted.voices[0].id;
  return { engine: wanted.id, model, voice };
}

export function Studio({ presets, initial, script, engines, defaults }: Props) {
  const t = useTranslations("studio");
  const tp = useTranslations("presets");
  const te = useTranslations("engines");
  const locale = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const seed = script ?? initial;
  const start = initialSelection(engines, defaults, seed?.model, seed?.voice);

  const [text, setText] = useState(script ? script.body : initial?.script ?? "");
  const [engineId, setEngineId] = useState(start.engine);
  const [model, setModel] = useState(start.model);
  const [voice, setVoice] = useState(start.voice);
  const [format, setFormat] = useState<Format>(seed?.format ?? "mp3");
  const [speed, setSpeed] = useState(seed?.speed ?? 1);
  const [instructions, setInstructions] = useState(seed?.instructions ?? tp("narratorText"));
  const [activePreset, setActivePreset] = useState<string | null>(seed?.instructions ? null : "narrator");
  const [scriptId, setScriptId] = useState<string | null>(script?.id ?? null);
  const [scriptTitle, setScriptTitle] = useState(script?.title ?? "");
  const [titleOpen, setTitleOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<GenerationWithUrl | null>(initial);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const engine = engines.find((e) => e.id === engineId);
  const modelSpec = engine?.models.find((m) => m.id === model);
  const voiceSpec = engine?.voices.find((v) => v.id === voice);
  const chars = text.length;
  const maxChars = engine?.maxChars ?? 20000;
  const over = chars > maxChars;
  const chunks = engine?.chunkChars ? Math.max(1, Math.ceil(chars / engine.chunkChars)) : 1;
  const est = useMemo(() => estimateSeconds(text, speed), [text, speed]);
  const canGenerate = Boolean(engine && text.trim().length > 0 && !over);

  function selectEngine(next: EngineView) {
    setEngineId(next.id);
    if (!next.models.some((m) => m.id === model)) setModel(next.models[0].id);
    if (!next.voices.some((v) => v.id === voice)) setVoice(next.voices[0].id);
    if (!next.formats.includes(format)) setFormat(next.formats[0]);
    setSpeed((s) => Math.min(next.speed.max, Math.max(next.speed.min, s)));
  }

  function applyPreset(key: string, value: string) {
    setActivePreset(key);
    setInstructions(value);
  }

  async function generate() {
    if (!engine) return;
    setError(null);
    if (engine.chunkChars && chunks > 1 && format !== "mp3") { setError(t("longNeedsMp3", { max: engine.chunkChars.toLocaleString() })); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, engine: engine.id, voice, model, format, speed, instructions: modelSpec?.instructions && instructions ? instructions : undefined, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("failed"));
      setCurrent(data.generation as GenerationWithUrl);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      setLoading(false);
    }
  }

  function insertPause() {
    const el = textareaRef.current; if (!el) return;
    const p = el.selectionStart;
    setText(text.slice(0, p) + " … " + text.slice(el.selectionEnd));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(p + 3, p + 3); });
  }

  async function persistScript(asNew: boolean) {
    const title = scriptTitle.trim();
    if (!title || !text.trim() || !engine) return;
    setSaving(true); setError(null);
    const result = await saveScript({
      id: asNew ? undefined : scriptId ?? undefined,
      title, text, engine: engine.id, voice, model, format, speed,
      instructions: modelSpec?.instructions && instructions ? instructions : undefined,
      locale: locale === "km" ? "km" : "en",
    });
    setSaving(false);
    if ("error" in result) { setError(result.error); return; }
    setScriptId(result.id); setTitleOpen(false);
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1800);
    startTransition(() => router.refresh());
  }

  function onSaveClick() {
    if (scriptId && scriptTitle.trim()) { persistScript(false); return; }
    setTitleOpen(true);
  }

  async function confirmPreset() {
    if (!presetName.trim()) return;
    await savePreset(presetName, instructions);
    setPresetName(""); setSavingPreset(false);
    startTransition(() => router.refresh());
  }

  if (!engine) {
    return (
      <div className="pane">
        <div className="empty">{t("noEngines")} <Link href="/settings" className="btn primary" style={{ marginLeft: 8 }}>{t("openSettings")}</Link></div>
      </div>
    );
  }

  return (
    <div className="pane">
      <div className="editor">
        <textarea id="script" ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("placeholder")} />
        <div className="editor-foot">
          <div className="tools">
            <button className="chip-btn" type="button" onClick={insertPause}>{t("insertPause")}</button>
            <button className="chip-btn" type="button" onClick={() => { setText(""); setScriptId(null); setScriptTitle(""); }}>{t("clear")}</button>
            <button className="chip-btn" type="button" onClick={() => setText(t("sample"))}>{t("loadSample")}</button>
            <span className="tools-sep" />
            {titleOpen ? (
              <>
                <input className="input slim" id="script-title" placeholder={t("scriptTitle")} value={scriptTitle} onChange={(e) => setScriptTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") persistScript(!scriptId); if (e.key === "Escape") setTitleOpen(false); }} autoFocus />
                <button className="chip-btn primary" type="button" onClick={() => persistScript(!scriptId)} disabled={saving || !scriptTitle.trim()}>OK</button>
                <button className="chip-btn" type="button" onClick={() => setTitleOpen(false)}>✕</button>
              </>
            ) : (
              <>
                {scriptId && <span className="editing" title={scriptTitle}>{t("editing")}: <b>{scriptTitle}</b></span>}
                <button className="chip-btn primary" type="button" onClick={onSaveClick} disabled={saving || !text.trim()}>
                  {savedFlash ? t("saved") : scriptId ? t("saveChanges") : t("saveScript")}
                </button>
                {scriptId && <button className="chip-btn" type="button" onClick={() => { setScriptTitle(""); setTitleOpen(true); }}>{t("saveAsNew")}</button>}
              </>
            )}
          </div>
          <div className="counter mono">
            <span className={over ? "over" : ""}><b>{chars.toLocaleString()}</b> / {maxChars.toLocaleString()} {t("chars")}</span>
            <span>~<b>{fmtDuration(est)}</b> {t("audio")}</span>
            <span>{t("request", { count: chunks })}</span>
          </div>
        </div>
      </div>

      {engines.length > 1 && (
        <div className="section-gap">
          <div className="row-head">
            <h2>{t("engine")}</h2>
            <Link href="/settings" className="hint">{t("openSettings")}</Link>
          </div>
          <div className="engine-select">
            {engines.map((e) => {
              const ok = e.status.available && e.status.enabled;
              return (
                <button key={e.id} type="button" className={e.id === engineId ? "on" : ""} disabled={!ok} title={ok ? undefined : t("engineNotReady")} onClick={() => selectEngine(e)}>
                  {te(e.nameKey)}
                  {!ok && <span className="hint">· {t("engineNotReady")}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="section-gap">
        <div className="row-head">
          <div className="inline-row">
            <h2>{t("voice")}</h2>
            {voiceSpec && <span className="pill"><Avatar voice={voice} size="xs" />{voiceSpec.name}</span>}
          </div>
          <span className="hint">{t("voiceHint")}</span>
        </div>
        <VoicePicker engine={engine.id} voices={engine.voices} value={voice} onChange={setVoice} />
      </div>

      {engine.stylePresets && (
        <div className="section-gap">
          <div className="row-head">
            <h2>{t("style")}</h2>
            <span className="hint">{modelSpec?.instructions ? t("styleHint") : t("styleUnavailable", { model: modelSpec?.label ?? model })}</span>
          </div>
          <div className="chips">
            {BUILT_IN.map((k) => (
              <button key={k} type="button" className={`chip ${activePreset === k ? "on" : ""}`} disabled={!modelSpec?.instructions} onClick={() => applyPreset(k, tp(`${k}Text`))}>{tp(k)}</button>
            ))}
            {presets.map((p) => (
              <span key={p.id} className={`chip ${activePreset === p.id ? "on" : ""}`} onClick={() => applyPreset(p.id, p.instructions)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") applyPreset(p.id, p.instructions); }}>
                {p.name}
                <button type="button" className="x" aria-label={`Delete ${p.name}`} onClick={async (e) => { e.stopPropagation(); await deletePreset(p.id); startTransition(() => router.refresh()); }}>×</button>
              </span>
            ))}
          </div>
          <div className="field">
            <label htmlFor="instructions">{t("instructions")}</label>
            <div className="inline-row">
              <input className="input" id="instructions" style={{ flex: 1, minWidth: 240 }} value={instructions} placeholder={t("instructionsPlaceholder")}
                disabled={!modelSpec?.instructions} onChange={(e) => { setInstructions(e.target.value); setActivePreset(null); }} />
              {savingPreset ? (
                <>
                  <input className="input" id="preset-name" style={{ width: 180 }} placeholder={t("presetName")} value={presetName} onChange={(e) => setPresetName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmPreset(); }} autoFocus />
                  <button className="btn primary" type="button" onClick={confirmPreset}>OK</button>
                </>
              ) : (
                <button className="btn" type="button" onClick={() => setSavingPreset(true)} disabled={!instructions.trim() || !modelSpec?.instructions}>{t("savePreset")}</button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="settings">
        {engine.models.length > 1 && (
          <div className="field">
            <label htmlFor="model">{t("model")}</label>
            <div className="select">
              <select className="input" id="model" value={model} onChange={(e) => setModel(e.target.value)}>
                {engine.models.map((m) => <option key={m.id} value={m.id}>{m.label}{m.noteKey ? ` · ${t(m.noteKey)}` : ""}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="format">{t("format")}</label>
          <div className="select">
            <select className="input" id="format" value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              {engine.formats.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="speed">{t("speed")}</label>
          <div className="range-wrap">
            <input type="range" id="speed" min={engine.speed.min} max={engine.speed.max} step={engine.speed.step} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
            <output className="mono">{speed.toFixed(2)}×</output>
          </div>
          <div className="ticks"><span>{engine.speed.min}×</span><span>1×</span><span>{engine.speed.max}×</span></div>
        </div>
      </div>

      {error && <div className="alert" role="alert">{error}</div>}

      <Player generation={current} loading={loading} canGenerate={canGenerate} onGenerate={generate} />
    </div>
  );
}
