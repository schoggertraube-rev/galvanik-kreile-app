"use client";

import { useState, useTransition } from "react";
import { saveCatalogServiceAction, saveCompanySettingsAction, saveManagedUserAction } from "@/app/actions/settings.actions";
import type { CompanySettingsInput, SystemSettingsSnapshot } from "@/modules/fundament/public";
import type { CatalogService } from "@/modules/katalog/public";
import styles from "./settings.module.css";

type Tab = "company" | "catalog" | "users";
const emptyService = (): CatalogService => ({ id: "", name: "", surface: "", unit: "Stück", netPriceCents: 0, vatRateBasisPoints: 1900, standardLeadTimeWorkingDays: 5, active: true });

export function SettingsAdminClient({ initialSnapshot, initialServices }: { initialSnapshot: SystemSettingsSnapshot; initialServices: CatalogService[] }) {
  const [tab, setTab] = useState<Tab>("company");
  const [company, setCompany] = useState(initialSnapshot.company);
  const [services, setServices] = useState(initialServices);
  const [draft, setDraft] = useState(emptyService());
  const [users, setUsers] = useState(initialSnapshot.users);
  const [pins, setPins] = useState<Record<string, string>>(Object.create(null));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const field = (key: keyof CompanySettingsInput, label: string, type = "text") => <label>{label}<input type={type} value={String(company[key])} onChange={(event) => setCompany((current) => ({ ...current, [key]: type === "number" ? Number(event.target.value) : event.target.value }))} /></label>;

  function run(task: () => Promise<{ code: string; message?: string }>, success: string) {
    startTransition(() => void task().then((result) => setMessage(result.code === "OK" ? success : result.message ?? "Speichern fehlgeschlagen.")));
  }

  return <main className={styles.page} data-testid="gregor-system-admin">
    <header><p>Systemadministration</p><h1>Einstellungen</h1><span>Firmendaten, Leistungen und bestehende Zugänge</span></header>
    <nav aria-label="Einstellungsbereiche">
      <button aria-pressed={tab === "company"} onClick={() => setTab("company")}>Firmendaten</button>
      <button aria-pressed={tab === "catalog"} onClick={() => setTab("catalog")}>Leistungskatalog</button>
      <button aria-pressed={tab === "users"} onClick={() => setTab("users")}>Nutzer & Rollen</button>
    </nav>
    {message ? <p role="status" className={styles.message}>{message}</p> : null}

    {tab === "company" ? <section><h2>Rechnungsabsender</h2><div className={styles.grid}>
      {field("companyName", "Firmenname")}{field("street", "Straße")}{field("zip", "PLZ")}{field("city", "Ort")}{field("country", "Land")}
      {field("taxId", "USt-ID / Steuernummer")}{field("iban", "IBAN")}{field("bic", "BIC")}{field("bankName", "Bank")}{field("paymentTermDays", "Zahlungsziel in Tagen", "number")}{field("logoUrl", "Logo-Pfad")}
    </div><button disabled={pending} onClick={() => run(() => saveCompanySettingsAction(company), "Firmendaten gespeichert.")}>Firmendaten speichern</button>
      <h3>Nummernkreise (systemverwaltet)</h3><dl className={styles.ranges}>{initialSnapshot.numberRanges.map((range) => <div key={range.label}><dt>{range.label}</dt><dd>{range.pattern}</dd></div>)}</dl>
    </section> : null}

    {tab === "catalog" ? <section><h2>Leistungskatalog</h2><div className={styles.grid}>
      <label>Bezeichnung<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>Oberfläche<input value={draft.surface} onChange={(e) => setDraft({ ...draft, surface: e.target.value })} /></label>
      <label>Einheit<input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></label>
      <label>Nettopreis in Cent<input type="number" min="0" value={draft.netPriceCents} onChange={(e) => setDraft({ ...draft, netPriceCents: Number(e.target.value) })} /></label>
      <label>Steuersatz<select value={draft.vatRateBasisPoints} onChange={(e) => setDraft({ ...draft, vatRateBasisPoints: Number(e.target.value) as 0|700|1900 })}><option value="1900">19 %</option><option value="700">7 %</option><option value="0">0 %</option></select></label>
      <label>Standard-Durchlaufzeit<input type="number" min="0" max="365" value={draft.standardLeadTimeWorkingDays} onChange={(e) => setDraft({ ...draft, standardLeadTimeWorkingDays: Number(e.target.value) })} /></label>
      <label className={styles.check}><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />Aktiv</label>
    </div><button disabled={pending} onClick={() => run(async () => { const result = await saveCatalogServiceAction({ ...draft, id: draft.id || null }); if (result.code === "OK") { setServices((current) => [...current.filter((item) => item.id !== result.service.id), result.service]); setDraft(emptyService()); } return result; }, "Leistung gespeichert.")}>Leistung speichern</button>
      <div className={styles.list}>{services.map((service) => <button key={service.id} onClick={() => setDraft(service)}><strong>{service.name}</strong><span>{service.surface} · {(service.netPriceCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} / {service.unit} · {service.active ? "aktiv" : "gesperrt"}</span></button>)}</div>
    </section> : null}

    {tab === "users" ? <section><h2>Bestehende Nutzer & Rollen</h2><p>Neue Zugänge: In Klärung. Bestehende Nutzer können sicher gepflegt werden.</p><div className={styles.list}>{users.map((user) => <article key={user.id}><strong>{user.fullName}</strong><span>{user.email}</span><select value={user.role} onChange={(e) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, role: e.target.value } : item))}><option value="admin">Admin</option><option value="meister">Meister</option><option value="buero">Büro</option><option value="werkstatt">Werkstatt</option></select><input aria-label={`Neue PIN für ${user.fullName}`} type="password" inputMode="numeric" placeholder="PIN unverändert" value={pins[user.id] ?? ""} onChange={(e) => setPins({ ...pins, [user.id]: e.target.value })} /><label className={styles.check}><input type="checkbox" checked={user.active} onChange={(e) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, active: e.target.checked } : item))} />Aktiv</label><button disabled={pending} onClick={() => run(() => saveManagedUserAction({ userId: user.id, role: user.role as "admin"|"meister"|"buero"|"werkstatt", active: user.active, pin: pins[user.id] || null }), `${user.fullName} gespeichert.`)}>Speichern</button></article>)}</div></section> : null}
  </main>;
}
