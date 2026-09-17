"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/Avatar";
import { removeEngineConfig, saveEngineConfig, setEngineDefaults, testEngine } from "@/lib/actions/engines";
import type { EngineView } from "@/lib/engines/types";
import type { EngineDefaults } from "@/lib/engine-settings";

type Props = { engines: EngineView[]; defaults: EngineDefaults; secretsEnabled: boolean };

export function EngineSettings({ engines, defaults, secretsEnabled }: Props) {
  const t = useTranslations("settings");
  const te = useTranslations("engines");
  const router = useRouter();
  const [, start] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>(Object.fromEntries(engines.map((e) => [e.id, e.status.enabled])));
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [defaultPick, setDefaultPick] = useState<{ engine: string; model: string; voice: string }>(() => {
    const first = engines.find((e) => e.status.available) ?? engines[0];
    return { engine: defaults.engine ?? first.id, model: defaults.model ?? first.models[0].id, voice: defaults.voice ?? first.voices[0].id };
  });

  const setField = (engineId: string, key: string, value: string) => setDrafts((d) => ({ ...d, [engineId]: { ...d[engineId], [key]: value } }));

  async function run(engineId: string, action: () => Promise<{ ok: true } | { ok: false; error: string }>, okText: string) {
    setBusy(engineId);
    const result = await action();
    setBusy(null);
    setMsg((m) => ({ ...m, [engineId]: result.ok ? { ok: true, text: okText } : { ok: false, text: result.error } }));
    if (result.ok) start(() => router.refresh());
  }

  const pickedEngine = engines.find((e) => e.id === defaultPick.engine) ?? engines[0];

  return (
    <div className="section-gap" style={{ gap: 22 }}>
      {!secretsEnabled && <div className="alert">{t("noSecret")}</div>}

      {engines.map((engine) => {
        const ready = engine.status.available;
        const statusText = ready ? (engine.status.source === "user" ? t("statusYourKey") : t("statusSite")) : t("statusNeedsKey");
        return (
        <section key={engine.id} className="engine-card">
          <div className="engine-head">
            <div>
              <h3>{te(engine.nameKey)} <span className={`tag ${engine.kind}`}>{t(engine.kind === "self-hosted" ? "selfHosted" : "external")}</span></h3>
              <p>{te(engine.descriptionKey)}</p>
            </div>
            <span className={`status-pill ${ready ? "ready" : "off"}`}><span className="dot" />{statusText}</span>
          </div>

          <div className="engine-grid">
            <div className="engine-col">
              <h4>{t("whatYouGet")}</h4>
              <dl className="spec">
                <dt>{t("spec.voices")}</dt>
                <dd>
                  <span className="engine-voices">{engine.voices.map((v) => <span key={v.id} className="voice-chip"><Avatar voice={v.id} size="xs" />{v.name}</span>)}</span>
                </dd>
                <dt>{t("spec.models")}</dt>
                <dd>{engine.models.map((m) => <span key={m.id} className="fact-chip">{m.label}</span>)}</dd>
                <dt>{t("spec.formats")}</dt>
                <dd>{engine.formats.map((f) => <span key={f} className="fact-chip">{f.toUpperCase()}</span>)}</dd>
                <dt>{t("spec.speed")}</dt>
                <dd>{t("speedRange", { min: engine.speed.min, max: engine.speed.max })}</dd>
                <dt>{t("spec.style")}</dt>
                <dd>{engine.stylePresets ? t("styleYes") : t("styleNo")}</dd>
                <dt>{t("spec.cost")}</dt>
                <dd>{engine.kind === "self-hosted" ? t("costFree") : t("costYourAccount")}</dd>
              </dl>
            </div>

            <div className="engine-col setup-col">
              <h4>{t("setup")}</h4>
              {engine.credentials.length === 0 ? (
                <p className="setup-note">{t("nothingToSetUp")}</p>
              ) : (
                <div className="engine-form">
                  <p className="setup-note">{ready && engine.status.source === "user" ? t("keySavedNote") : t("needsKeyNote")}</p>
                  {engine.credentials.map((f) => (
                    <div className="field" key={f.key}>
                      <label htmlFor={`${engine.id}-${f.key}`}>{t(`fields.${f.labelKey}`)}{f.required ? "" : ` (${t("optional")})`}</label>
                      <input
                        className="input"
                        id={`${engine.id}-${f.key}`}
                        type={f.secret ? "password" : "text"}
                        autoComplete="off"
                        placeholder={f.secret && engine.status.fields[f.key] ? t("secretSet") : f.placeholder}
                        defaultValue={f.secret ? "" : engine.status.fields[f.key]}
                        onChange={(e) => setField(engine.id, f.key, e.target.value)}
                      />
                      {f.helpKey && <span className="hint">{t(`fields.${f.helpKey}`)}</span>}
                    </div>
                  ))}
                  {engine.docsUrl && <a className="link" href={engine.docsUrl} target="_blank" rel="noreferrer">{t("whereToGetKey")} ↗</a>}
                </div>
              )}
              <div className="engine-actions">
                <label className="switch">
                  <input type="checkbox" checked={enabled[engine.id]} onChange={(e) => setEnabled((s) => ({ ...s, [engine.id]: e.target.checked }))} />
                  <span>{t("enabledInStudio")}</span>
                </label>
                <span style={{ flex: 1 }} />
                {msg[engine.id] && <span className={`hint ${msg[engine.id].ok ? "ok" : "err"}`}>{msg[engine.id].text}</span>}
                {engine.status.source === "user" && (
                  <button className="btn" type="button" disabled={busy === engine.id} onClick={() => run(engine.id, () => removeEngineConfig(engine.id), t("removed"))}>{t("removeKey")}</button>
                )}
                <button className="btn" type="button" disabled={busy === engine.id || !ready} onClick={() => run(engine.id, () => testEngine(engine.id), t("testOk"))}>{busy === engine.id ? t("testing") : t("test")}</button>
                <button className="btn primary" type="button" disabled={busy === engine.id} onClick={() => run(engine.id, () => saveEngineConfig(engine.id, drafts[engine.id] ?? {}, enabled[engine.id]), t("saved"))}>{t("save")}</button>
              </div>
            </div>
          </div>
        </section>
        );
      })}

      <section className="engine-card">
        <div className="engine-head"><div><h3>{t("defaultsTitle")}</h3><p>{t("defaultsHint")}</p></div></div>
        <div className="settings">
          <div className="field">
            <label htmlFor="def-engine">{t("engine")}</label>
            <div className="select"><select className="input" id="def-engine" value={defaultPick.engine} onChange={(e) => { const en = engines.find((x) => x.id === e.target.value)!; setDefaultPick({ engine: en.id, model: en.models[0].id, voice: en.voices[0].id }); }}>
              {engines.map((e) => <option key={e.id} value={e.id}>{te(e.nameKey)}</option>)}
            </select></div>
          </div>
          <div className="field">
            <label htmlFor="def-model">{t("model")}</label>
            <div className="select"><select className="input" id="def-model" value={defaultPick.model} onChange={(e) => setDefaultPick((d) => ({ ...d, model: e.target.value }))}>
              {pickedEngine.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select></div>
          </div>
          <div className="field">
            <label htmlFor="def-voice">{t("voice")}</label>
            <div className="select"><select className="input" id="def-voice" value={defaultPick.voice} onChange={(e) => setDefaultPick((d) => ({ ...d, voice: e.target.value }))}>
              {pickedEngine.voices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select></div>
          </div>
        </div>
        <div className="engine-actions">
          <span style={{ flex: 1 }} />
          {msg.defaults && <span className={`hint ${msg.defaults.ok ? "ok" : "err"}`}>{msg.defaults.text}</span>}
          <button className="btn primary" type="button" disabled={busy === "defaults"} onClick={() => run("defaults", () => setEngineDefaults(defaultPick.engine, defaultPick.model, defaultPick.voice), t("saved"))}>{t("saveDefaults")}</button>
        </div>
      </section>
    </div>
  );
}
