"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveCatalogServiceAction, saveCompanySettingsAction, saveManagedUserAction, saveSalesStageFeatureAction } from "@/app/actions/settings.actions";
import { setExtraWorkHourlyRateAction } from "@/app/actions/orders.actions";
import { SALES_STAGE_FEATURES, type CompanySettingsInput, type SalesStageFeatureId, type SystemSettingsSnapshot } from "@/modules/fundament/public";
import type { CatalogService } from "@/modules/katalog/public";
import styles from "./settings.module.css";

type Tab = "company" | "catalog" | "users" | "features";
const emptyService = (): CatalogService => ({ id: "", name: "", surface: "", unit: "Stück", netPriceCents: 0, vatRateBasisPoints: 1900, standardLeadTimeWorkingDays: 5, active: true });

export function SettingsAdminClient({ initialSnapshot, initialServices, returnTo = null }: { initialSnapshot: SystemSettingsSnapshot; initialServices: CatalogService[]; returnTo?: string | null }) {
  const [tab, setTab] = useState<Tab>("company");
  const [company, setCompany] = useState(initialSnapshot.company);
  const [services, setServices] = useState(initialServices);
  const [draft, setDraft] = useState(emptyService());
  const [users, setUsers] = useState(initialSnapshot.users);
  const [features, setFeatures] = useState(initialSnapshot.features);
  const [hourlyRate, setHourlyRate] = useState(initialSnapshot.extraWorkHourlyRate);
  const [hourlyRateEuro, setHourlyRateEuro] = useState(initialSnapshot.extraWorkHourlyRate.hourlyRateCents === null ? "" : (initialSnapshot.extraWorkHourlyRate.hourlyRateCents / 100).toFixed(2).replace(".", ","));
  const [pins, setPins] = useState<Record<string, string>>(Object.create(null));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const companyReady = Object.entries(company).every(([key, value]) => key === "paymentTermDays" ? Number(value) > 0 : String(value).trim().length > 0);
  const catalogReady = services.length > 0;
  const rateReady = hourlyRate.hourlyRateCents !== null;
  const field = (key: keyof CompanySettingsInput, label: string, type = "text") => <label>{label}<input type={type} value={String(company[key])} onChange={(event) => setCompany((current) => ({ ...current, [key]: type === "number" ? Number(event.target.value) : event.target.value }))} /></label>;

  function run(task: () => Promise<{ code: string; message?: string }>, success: string) {
    startTransition(() => void task().then((result) => setMessage(result.code === "OK" ? success : result.message ?? "Speichern fehlgeschlagen.")));
  }

  function saveHourlyRate() {
    const value = Number(hourlyRateEuro.replace(",", "."));
    const hourlyRateCents = Math.round(value * 100);
    if (!Number.isFinite(value) || hourlyRateCents < 1 || hourlyRateCents > 1_000_000) {
      setMessage("Bitte einen gültigen Stundensatz zwischen 0,01 € und 10.000 € eingeben.");
      return;
    }
    startTransition(() => void setExtraWorkHourlyRateAction({
      rateId: crypto.randomUUID(),
      expectedVersion: hourlyRate.version,
      hourlyRateCents,
      clientEventId: crypto.randomUUID(),
    }).then((result) => {
      if (result.code !== "OK") {
        setMessage(result.message);
        return;
      }
      setHourlyRate({ rateId: result.receipt.rateId, hourlyRateCents: result.receipt.hourlyRateCents, version: result.receipt.aggregateVersion });
      setHourlyRateEuro((result.receipt.hourlyRateCents / 100).toFixed(2).replace(".", ","));
      setMessage("Stundensatz Mehrarbeit gespeichert.");
    }));
  }

  function saveCompany() {
    startTransition(() => void saveCompanySettingsAction(company).then((result) => {
      setMessage(result.code === "OK" ? "Firmendaten gespeichert. Jetzt eine Leistung anlegen." : result.message ?? "Speichern fehlgeschlagen.");
      if (result.code === "OK") setTab("catalog");
    }));
  }

  function saveService() {
    startTransition(() => void saveCatalogServiceAction({ ...draft, id: draft.id || null }).then((result) => {
      if (result.code !== "OK") { setMessage(result.message ?? "Speichern fehlgeschlagen."); return; }
      setServices((current) => [...current.filter((item) => item.id !== result.service.id), result.service]);
      setDraft(emptyService());
      setTab("company");
      setMessage("Leistung gespeichert. Jetzt den Stundensatz festlegen.");
      requestAnimationFrame(() => document.getElementById("extra-work-rate")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }));
  }

  return <main className={styles.page} data-testid="gregor-system-admin">
    <header><p>Systemadministration</p><h1>Einstellungen</h1><span>Firmendaten, Leistungen und bestehende Zugänge</span></header>
    <section className={styles.setup} aria-label="Ersteinrichtung">
      <div><strong>1. Firmendaten</strong><span>{companyReady ? "vollständig" : "noch offen"}</span></div>
      <div><strong>2. Leistung mit Preis</strong><span>{catalogReady ? "vorhanden" : "noch offen"}</span></div>
      <div><strong>3. Stundensatz</strong><span>{rateReady ? "gespeichert" : "noch offen"}</span></div>
      {companyReady && catalogReady && rateReady && returnTo ? <Link href={returnTo}>Zurück zum vorherigen Vorgang</Link> : null}
    </section>
    <nav aria-label="Einstellungsbereiche">
      <button aria-pressed={tab === "company"} onClick={() => setTab("company")}>Firmendaten</button>
      <button aria-pressed={tab === "catalog"} onClick={() => setTab("catalog")}>Leistungskatalog</button>
      <button aria-pressed={tab === "users"} onClick={() => setTab("users")}>Nutzer & Rollen</button>
      <button aria-pressed={tab === "features"} onClick={() => setTab("features")}>Stufen-Schalter</button>
    </nav>
    {message ? <p role="status" className={styles.message}>{message}</p> : null}

    {tab === "company" ? <section><h2>Rechnungsabsender</h2><div className={styles.grid}>
      {field("companyName", "Firmenname")}{field("street", "Straße")}{field("zip", "PLZ")}{field("city", "Ort")}{field("country", "Land")}
      {field("taxId", "USt-ID / Steuernummer")}{field("iban", "IBAN")}{field("bic", "BIC")}{field("bankName", "Bank")}{field("paymentTermDays", "Zahlungsziel in Tagen", "number")}{field("logoUrl", "Logo-Pfad")}
    </div><button disabled={pending} onClick={saveCompany}>Firmendaten speichern</button>
      <div id="extra-work-rate"><h3>Mehrarbeit</h3><div className={styles.grid}><label>Stundensatz Mehrarbeit (€/h)<input inputMode="decimal" value={hourlyRateEuro} onChange={(event) => setHourlyRateEuro(event.target.value)} placeholder="z. B. 85,00" /></label></div>
      <button disabled={pending} onClick={saveHourlyRate}>Stundensatz speichern</button>
      </div>
      <h3>Nummernkreise (systemverwaltet)</h3><dl className={styles.ranges}>{initialSnapshot.numberRanges.map((range) => <div key={range.label}><dt>{range.label}</dt><dd>{range.pattern}</dd></div>)}</dl>
    </section> : null}

    {tab === "catalog" ? <section><h2>Leistungskatalog</h2><div className={styles.grid}>
      <label>Bezeichnung<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>Oberfläche<input value={draft.surface} onChange={(e) => setDraft({ ...draft, surface: e.target.value })} /></label>
      <label>Einheit<input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></label>
      <label>Nettopreis (€)<input type="number" min="0" step="0.01" value={draft.netPriceCents / 100} onChange={(e) => setDraft({ ...draft, netPriceCents: Math.round(Number(e.target.value) * 100) })} /></label>
      <label>Steuersatz<select value={draft.vatRateBasisPoints} onChange={(e) => setDraft({ ...draft, vatRateBasisPoints: Number(e.target.value) as 0|700|1900 })}><option value="1900">19 %</option><option value="700">7 %</option><option value="0">0 %</option></select></label>
      <label>Standard-Durchlaufzeit<input type="number" min="0" max="365" value={draft.standardLeadTimeWorkingDays} onChange={(e) => setDraft({ ...draft, standardLeadTimeWorkingDays: Number(e.target.value) })} /></label>
      <label className={styles.check}><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />Aktiv</label>
    </div><button disabled={pending} onClick={saveService}>Leistung speichern</button>
      <div className={styles.list}>{services.map((service) => <button key={service.id} onClick={() => setDraft(service)}><strong>{service.name}</strong><span>{service.surface} · {(service.netPriceCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} / {service.unit} · {service.active ? "aktiv" : "gesperrt"}</span></button>)}</div>
    </section> : null}

    {tab === "users" ? <section><h2>Bestehende Nutzer & Rollen</h2><div className={styles.planned} aria-label="Nutzer anlegen geplant"><div><strong>Nutzer anlegen</strong><span>Kommt mit einer eigenen Auth-Erweiterung. In Stufe 1 werden Rolf, Phillip und Gregor gepflegt.</span></div><span className={styles.plannedTag}>geplant</span></div><div className={styles.list}>{users.map((user) => <article key={user.id}><strong>{user.fullName}</strong><span>{user.email}</span><select value={user.role} onChange={(e) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, role: e.target.value } : item))}><option value="admin">Admin</option><option value="meister">Meister</option><option value="buero">Büro</option><option value="werkstatt">Werkstatt</option></select><input aria-label={`Neue PIN für ${user.fullName}`} type="password" inputMode="numeric" placeholder="PIN unverändert" value={pins[user.id] ?? ""} onChange={(e) => setPins({ ...pins, [user.id]: e.target.value })} /><label className={styles.check}><input type="checkbox" checked={user.active} onChange={(e) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, active: e.target.checked } : item))} />Aktiv</label><button disabled={pending} onClick={() => run(() => saveManagedUserAction({ userId: user.id, role: user.role as "admin"|"meister"|"buero"|"werkstatt", active: user.active, pin: pins[user.id] || null }), `${user.fullName} gespeichert.`)}>Speichern</button></article>)}</div></section> : null}

    {tab === "features" ? <section><h2>Verkaufsstufen</h2><p>Stufe 1 ist standardmäßig aktiv. Anschlussstellen der Stufen 2 bis 4 bleiben aus, bis ihr Paket freigegeben ist.</p><div className={styles.featureList}>{([1, 2, 3, 4] as const).map((stage) => <div key={stage}><h3>Stufe {stage}</h3>{SALES_STAGE_FEATURES.filter((definition) => definition.stage === stage).map((definition) => { const feature = features.find((item) => item.id === definition.id); return <article key={definition.id}><span><strong>{definition.id}</strong> · {definition.label}</span><label className={styles.check}><input type="checkbox" aria-label={`${definition.id} ${definition.label}`} checked={feature?.enabled === true} onChange={(event) => { const enabled = event.target.checked; const featureId = definition.id as SalesStageFeatureId; run(async () => { const result = await saveSalesStageFeatureAction({ featureId, enabled }); if (result.code === "OK") setFeatures((current) => current.map((item) => item.id === featureId ? { ...item, enabled } : item)); return result; }, `${definition.id} ${enabled ? "aktiviert" : "deaktiviert"}.`); }} disabled={pending || !feature} />{feature?.enabled ? "An" : "Aus"}</label></article>; })}</div>)}</div></section> : null}
  </main>;
}
