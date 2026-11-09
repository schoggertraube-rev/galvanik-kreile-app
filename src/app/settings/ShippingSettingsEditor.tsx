"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readShippingSettingsAction, saveShippingSettingsAction } from "@/app/actions/settings.actions";
import {DispatchPolicyFields,type DispatchPolicy,type ShippingSettings } from "@/modules/fundament/public";
import styles from "./settings.module.css";

type Fields = Pick<ShippingSettings, "service" | "numberPattern" | "numberHint" | "trackingUrl">;
const fields = (value: ShippingSettings): Fields => ({
  service: value.service, numberPattern: value.numberPattern,
  numberHint: value.numberHint, trackingUrl: value.trackingUrl,
});

/** The existing company row and its version remain the only shipping configuration. */
export function ShippingSettingsEditor() {
  const [policy,setPolicy]=useState<DispatchPolicy|null>(null),[policyDirty,setPolicyDirty]=useState(false);
  const [saved, setSaved] = useState<ShippingSettings | null>(null);
  const [draft, setDraft] = useState<Fields | null>(null);
  const [conflict, setConflict] = useState<ShippingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const writing = useRef(false), readId = useRef(0);
  const container = useRef<HTMLElement>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const request = ++readId.current;
    setLoading(true); setError(null); setMessage(null);
    try {
      const result = await readShippingSettingsAction();
      if (request !== readId.current || signal?.aborted) return;
      if (result.code === "NOT_FOUND") {
        setSaved(null); setDraft(null); setConflict(null);
        setMessage("Firmendaten zuerst speichern. Versandangaben können danach ergänzt werden.");
        return;
      }
      if (result.code !== "OK") { setError(result.message); return; }
      setSaved(result.settings);setPolicy(result.settings.dispatchPolicy??null);setPolicyDirty(false); setDraft(fields(result.settings)); setConflict(null);
    } catch (failure) {
      console.error("[SHIPPING_EDITOR_READ_FAILED]", failure);
      if (request === readId.current && !signal?.aborted) setError("Versandangaben konnten nicht geladen werden · Fehlercode: SHIPPING_EDITOR_READ_FAILED.");
    } finally { if (request === readId.current && !signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [load]);

  const save = async () => {
    if (writing.current || !saved || !draft || conflict) return;
    writing.current = true; setBusy(true); setError(null); setMessage(null);
    const input = { ...draft,...(policyDirty?{dispatchPolicy:policy}:{}), expectedUpdatedAt: saved.updatedAt };
    try {
      const result = await saveShippingSettingsAction(input);
      if (result.code !== "OK") {
        if (result.code === "CONFLICT" && result.current) setConflict(result.current);
        setError(result.message + " · Ihre Eingaben sind noch da."); return;
      }
      if (!result.settings) throw new Error("SHIPPING_EDITOR_SAVE_RECEIPT_MISSING");
      const read = await readShippingSettingsAction();
      if (read.code !== "OK") { setError("Versandangaben gespeichert; erneutes Lesen fehlgeschlagen · " + read.message); return; }
      if (JSON.stringify(fields(read.settings)) !== JSON.stringify(fields(result.settings))||JSON.stringify(read.settings.dispatchPolicy)!==JSON.stringify(result.settings.dispatchPolicy)) {
        setConflict(read.settings); setError("Versandangaben wurden erneut geändert · gespeicherten Stand mit Ihren Eingaben abgleichen."); return;
      }
      setSaved(read.settings);setPolicy(read.settings.dispatchPolicy??null);setPolicyDirty(false); setDraft(fields(read.settings)); setMessage("Versandangaben gespeichert.");
    } catch (failure) {
      console.error("[SHIPPING_EDITOR_WRITE_FAILED]", failure);
      setError("Versandangaben nicht sicher bestätigt · Ihre Eingaben sind noch da · Fehlercode: SHIPPING_EDITOR_WRITE_FAILED.");
    } finally { writing.current = false; setBusy(false); }
  };

  const field = (key: keyof Fields, label: string, maxLength: number) => <label>{label}<input
    value={draft?.[key] ?? ""} maxLength={maxLength} disabled={busy}
    onKeyDown={event => {
      if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
      event.preventDefault();
      const inputs = Array.from(container.current?.querySelectorAll("input") ?? []);
      const next = inputs[inputs.indexOf(event.currentTarget) + 1];
      if (next) { next.focus(); next.scrollIntoView?.({ block: "nearest" }); } else void save();
    }}
    onChange={event => { const value = event.target.value; setMessage(null); setDraft(current => current ? { ...current, [key]: key === "trackingUrl" && value === "" ? null : value } : current); }}
  /></label>;

  return <section ref={container} aria-labelledby="shipping-settings-heading" data-spec-id="firmendaten.versand">
    <h3 id="shipping-settings-heading">Versand</h3>
    {loading ? <p role="status">Versandangaben werden geladen …</p> : null}
    {draft ? <><div className={styles.grid}>
      {field("service", "Versanddienst", 40)}
      {field("numberPattern", "Format der Sendungsnummer", 160)}
      {field("numberHint", "Hinweis zur Sendungsnummer", 160)}
      {field("trackingUrl", "Sendungsverfolgung (HTTPS-Adresse mit {nr})", 1000)}
    </div><DispatchPolicyFields value={policy} disabled={busy||loading} onChange={value=>{setPolicy(value);setPolicyDirty(true);setMessage(null);}}/><button type="button" disabled={busy || loading || Boolean(conflict)} onClick={() => void save()}>{busy ? "Versandangaben werden gespeichert …" : "Versandangaben speichern"}</button></> : null}
    {error ? <p role="alert">{error}</p> : null}
    {!saved && !loading ? <button type="button" onClick={() => void load()}>Versandangaben erneut lesen</button> : null}
    {conflict ? <div role="region" aria-label="Geänderter Versandstand"><p>Aktuell gespeichert:</p><dl>
      <dt>Versanddienst</dt><dd>{conflict.service}</dd><dt>Format der Sendungsnummer</dt><dd>{conflict.numberPattern || "keine Formatprüfung"}</dd>
      <dt>Hinweis zur Sendungsnummer</dt><dd>{conflict.numberHint || "kein Hinweis eingetragen"}</dd><dt>Sendungsverfolgung</dt><dd>{conflict.trackingUrl || "kein Link eingetragen"}</dd>
    </dl><button type="button" onClick={() => { setSaved(conflict);setPolicy(conflict.dispatchPolicy??null);setPolicyDirty(false); setDraft(fields(conflict)); setConflict(null); setError(null); }}>Gespeicherten Stand übernehmen</button>
      <button type="button" onClick={() => { setSaved(conflict); setConflict(null); setError(null); }}>Meine Eingaben nach Abgleich beibehalten</button></div> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
