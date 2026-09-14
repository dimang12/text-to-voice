"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/Avatar";
import { Player } from "@/components/Player";
import { VoicePicker } from "@/components/VoicePicker";
import { deletePreset, savePreset } from "@/lib/actions/library";
import { saveScript } from "@/lib/actions/scripts";
import { estimateSeconds, fmtDuration } from "@/lib/format";
import { FORMATS, MAX_CHUNK_CHARS, MAX_TOTAL_CHARS, MODELS, MODEL_PROVIDER, voicesFor, type Format, type Model, type Voice } from "@/lib/tts";
import type { GenerationWithUrl, Preset, SavedScript } from "@/lib/types";

type Props = { presets: Preset[]; initial: GenerationWithUrl | null; script: SavedScript | null };

const BUILT_IN = ["narrator", "bedtime", "radio", "news", "casual", "whisper"] as const;

export function Studio({ presets, initial, script }: Props) {
  const t = useTranslations("studio");
  const tp = useTranslations("presets");
  const locale = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const seed = script ?? initial;
  const seedText = script ? script.body : initial?.script ?? "";
  const [text, setText] = useState(seedText);
  const [voice, setVoice] = useState<Voice>(seed?.voice ?? "alloy");
  const [model, setModel] = useState<Model>(seed?.model ?? "gpt-4o-mini-tts");
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

  const chars = text.length;
  const over = chars > MAX_TOTAL_CHARS;
  const chunks = Math.max(1, Math.ceil(chars / MAX_CHUNK_CHARS));
  const est = useMemo(() => estimateSeconds(text, speed), [text, speed]);
  const canGenerate = text.trim().length > 0 && !over;

  const modelLabel: Record<Model, string> = {
    "gpt-4o-mini-tts": `gpt-4o-mini-tts · ${t("modelSteerable")}`,
    "tts-1": `tts-1 · ${t("modelFast")}`,
    "tts-1-hd": `tts-1-hd · ${t("modelHd")}`,
    "mms-tts": `MMS · ${t("modelMms")}`,
  };
  const isMms = MODEL_PROVIDER[model] === "mms";

  function changeModel(next: Model) {
    setModel(next);
    const allowed = voicesFor(next);
    if (!allowed.includes(voice)) setVoice(allowed[0]);
    if (MODEL_PROVIDER[next] === "mms" && format === "pcm") setFormat("mp3");
  }

  function applyPreset(key: string, value: string) {
    setActivePreset(key);
    setInstructions(value);
  }

  async function generate() {
    setError(null);
    if (chunks > 1 && format !== "mp3") { setError(t("longNeedsMp3", { max: MAX_CHUNK_CHARS.toLocaleString() })); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, model, format, speed, instructions: instructions || undefined, locale }),
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
    const next = text.slice(0, p) + " … " + text.slice(el.selectionEnd);
    setText(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(p + 3, p + 3); });
  }

  async function persistScript(asNew: boolean) {
    const title = scriptTitle.trim();
    if (!title || !text.trim()) return;
    setSaving(true); setError(null);
    const result = await saveScript({
      id: asNew ? undefined : scriptId ?? undefined,
      title, text, voice, model, format, speed,
      instructions: model === "gpt-4o-mini-tts" && instructions ? instructions : undefined,
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

  return (
    <div className="pane">
      <div className="editor">
        <textarea
          id="script"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("placeholder")}
        />
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
            <span className={over ? "over" : ""}><b>{chars.toLocaleString()}</b> / {MAX_TOTAL_CHARS.toLocaleString()} {t("chars")}</span>
            <span>~<b>{fmtDuration(est)}</b> {t("audio")}</span>
            <span>{t("request", { count: chunks })}</span>
          </div>
        </div>
      </div>

      <div className="section-gap">
        <div className="row-head">
          <div className="inline-row">
            <h2>{t("voice")}</h2>
            <span className="pill"><Avatar voice={voice} size="xs" />{voice[0].toUpperCase() + voice.slice(1)}</span>
          </div>
          <span className="hint">{t("voiceHint")}</span>
        </div>
        <VoicePicker value={voice} model={model} onChange={setVoice} />
      </div>

      <div className="section-gap">
        <div className="row-head">
          <h2>{t("style")}</h2>
          <span className="hint">{isMms ? t("styleMms") : t("styleHint")}</span>
        </div>
        <div className="chips">
          {BUILT_IN.map((k) => (
            <button key={k} type="button" className={`chip ${activePreset === k ? "on" : ""}`} onClick={() => applyPreset(k, tp(`${k}Text`))}>
              {tp(k)}
            </button>
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
            <input
              className="input"
              id="instructions"
              style={{ flex: 1, minWidth: 240 }}
              value={instructions}
              placeholder={t("instructionsPlaceholder")}
              disabled={model !== "gpt-4o-mini-tts"}
              onChange={(e) => { setInstructions(e.target.value); setActivePreset(null); }}
            />
            {savingPreset ? (
              <>
                <input className="input" id="preset-name" style={{ width: 180 }} placeholder={t("presetName")} value={presetName} onChange={(e) => setPresetName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmPreset(); }} autoFocus />
                <button className="btn primary" type="button" onClick={confirmPreset}>OK</button>
              </>
            ) : (
              <button className="btn" type="button" onClick={() => setSavingPreset(true)} disabled={!instructions.trim() || model !== "gpt-4o-mini-tts"}>{t("savePreset")}</button>
            )}
          </div>
        </div>
      </div>

      <div className="settings">
        <div className="field">
          <label htmlFor="model">{t("model")}</label>
          <div className="select">
            <select className="input" id="model" value={model} onChange={(e) => changeModel(e.target.value as Model)}>
              {MODELS.map((m) => <option key={m} value={m}>{modelLabel[m]}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="format">{t("format")}</label>
          <div className="select">
            <select className="input" id="format" value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              {FORMATS.filter((f) => !(isMms && f === "pcm")).map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="speed">{t("speed")}</label>
          <div className="range-wrap">
            <input type="range" id="speed" min={isMms ? 0.5 : 0.25} max={isMms ? 2 : 4} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
            <output className="mono">{speed.toFixed(2)}×</output>
          </div>
          <div className="ticks"><span>{isMms ? "0.5×" : "0.25×"}</span><span>1×</span><span>{isMms ? "2×" : "4×"}</span></div>
        </div>
      </div>

      {error && <div className="alert" role="alert">{error}</div>}

      <Player generation={current} loading={loading} canGenerate={canGenerate} onGenerate={generate} />
    </div>
  );
}
