"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  changeOwnPinAction,
  createManagedUserAction,
  saveCatalogServiceAction,
  saveCompanySettingsAction,
  saveManagedUserAction,
  setManagedUserAreaAction,
} from "@/app/actions/settings.actions";
import { setExtraWorkHourlyRateAction } from "@/app/actions/orders.actions";
import {
  ACCESS_AREAS,
  ACCESS_AREA_LABELS,
  isAccessAreaAllowedForRole,
  type AccessArea,
  type CompanySettingsInput,
  type ManagedUser,
  type SystemSettingsSnapshot,
} from "@/modules/fundament/public";
import type { CatalogService } from "@/modules/katalog/public";
import { runServerAction } from "@/lib/client/runServerAction";
import { Dialog, DialogAktionsmeldung, type DialogMeldung } from "@/ui/kr/Dialog";
import { Toast } from "@/ui/kr/Toast";
import styles from "./settings.module.css";

type Tab = "company" | "catalog" | "users";
type Result = { code: string; message?: string };
type RightChange = { userId: string; area: AccessArea; granted: boolean; isCurrent: boolean };

function rightChangeKey(userId: string, area: AccessArea): string {
  return `${userId}:${area}`;
}

function applyRightChanges(users: ManagedUser[], changes: RightChange[]): ManagedUser[] {
  return changes.reduce((current, change) => current.map((user) => {
    if (user.id !== change.userId) return user;
    const areas = change.granted
      ? [...new Set([...user.areas, change.area])]
      : user.areas.filter((area) => area !== change.area);
    return { ...user, areas };
  }), users);
}

const emptyService = (): CatalogService => ({
  id: "",
  name: "",
  surface: "",
  unit: "Stück",
  netPriceCents: 0,
  vatRateBasisPoints: 1900,
  standardLeadTimeWorkingDays: 5,
  active: true,
});

function suggestedShortCode(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts.map((part) => part[0]).join("").replace(/[^A-Za-zÄÖÜäöü0-9]/g, "").toUpperCase();
  return (initials || fullName.replace(/[^A-Za-zÄÖÜäöü0-9]/g, "").slice(0, 2).toUpperCase()).slice(0, 3);
}

export function SettingsAdminClient({
  initialSnapshot,
  initialServices,
  returnTo = null,
}: {
  initialSnapshot: SystemSettingsSnapshot;
  initialServices: CatalogService[];
  returnTo?: string | null;
}) {
  const { canManageCompany, canManageLogins } = initialSnapshot.capabilities ?? {
    canManageCompany: true,
    canManageLogins: true,
    canManageSystem: true,
  };
  const [tab, setTab] = useState<Tab>(
    canManageCompany ? "company" : canManageLogins || initialSnapshot.users.some((user) => user.isCurrent) ? "users" : "company",
  );
  const [company, setCompany] = useState<CompanySettingsInput>({
    companyName: initialSnapshot.company.companyName ?? "",
    street: initialSnapshot.company.street ?? "",
    zip: initialSnapshot.company.zip ?? "",
    city: initialSnapshot.company.city ?? "",
    country: initialSnapshot.company.country ?? "",
    taxId: initialSnapshot.company.taxId ?? "",
    iban: initialSnapshot.company.iban ?? "",
    bic: initialSnapshot.company.bic ?? "",
    bankName: initialSnapshot.company.bankName ?? "",
    paymentTermDays: initialSnapshot.company.paymentTermDays ?? 0,
    logoUrl: initialSnapshot.company.logoUrl ?? "",
  });
  const [services, setServices] = useState(initialServices);
  const [draft, setDraft] = useState(emptyService());
  const [users, setUsers] = useState(initialSnapshot.users);
  const [hourlyRate, setHourlyRate] = useState(initialSnapshot.extraWorkHourlyRate);
  const [hourlyRateEuro, setHourlyRateEuro] = useState(
    initialSnapshot.extraWorkHourlyRate.hourlyRateCents === null
      ? ""
      : (initialSnapshot.extraWorkHourlyRate.hourlyRateCents / 100).toFixed(2).replace(".", ","),
  );
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editPin, setEditPin] = useState("");
  const [newLogin, setNewLogin] = useState({ fullName: "", shortCode: "", designation: "", template: "werkstatt" as "werkstatt" | "meister" | "leer", pin: "" });
  const [createLoginOpen, setCreateLoginOpen] = useState(false);
  const [ownCode, setOwnCode] = useState({ first: "", repeat: "" });
  const [ownCodeOpen, setOwnCodeOpen] = useState(false);
  const [ownCodeMessage, setOwnCodeMessage] = useState<DialogMeldung | null>(null);
  const [editUserMessage, setEditUserMessage] = useState<DialogMeldung | null>(null);
  const [createLoginMessage, setCreateLoginMessage] = useState<DialogMeldung | null>(null);
  const [rightsMessage, setRightsMessage] = useState<DialogMeldung | null>(null);
  const [rightChanges, setRightChanges] = useState<Record<string, RightChange>>({});
  const [rightsToast, setRightsToast] = useState<string | null>(null);
  const [reloadAfterRightsSave, setReloadAfterRightsSave] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const companyReady = Object.entries(company).every(([key, value]) => key === "paymentTermDays" ? Number(value) > 0 : String(value).trim().length > 0);
  const catalogReady = services.length > 0;
  const rateReady = hourlyRate.hourlyRateCents !== null;
  const currentUser = users.find((user) => user.isCurrent) ?? null;
  const visibleUsers = canManageLogins ? users : currentUser ? [currentUser] : [];
  const activeUsers = visibleUsers.filter((user) => user.active);
  const inactiveUsers = visibleUsers.filter((user) => !user.active);
  const rightChangeCount = Object.keys(rightChanges).length;

  useEffect(() => {
    if (!rightsToast) return;
    const timeout = window.setTimeout(() => {
      setRightsToast(null);
      if (reloadAfterRightsSave) window.location.reload();
    }, 4_000);
    return () => window.clearTimeout(timeout);
  }, [reloadAfterRightsSave, rightsToast]);

  const field = (key: keyof CompanySettingsInput, label: string, type = "text") => (
    <label>{label}<input type={type} value={String(company[key])} onChange={(event) => setCompany((current) => ({ ...current, [key]: type === "number" ? Number(event.target.value) : event.target.value }))} /></label>
  );

  function report(
    task: () => Promise<Result>,
    success: string,
    after?: () => void,
    setLocalMessage?: (message: DialogMeldung | null) => void,
  ) {
    startTransition(async () => {
      const execution = await runServerAction(task, "Speichern");
      if (!execution.ok) {
        if (setLocalMessage) setLocalMessage({ text: execution.message, ton: "fehler" });
        else setMessage(execution.message);
        return;
      }
      const result = execution.value;
      if (result.code !== "OK") {
        const failure = result.message ?? "Speichern fehlgeschlagen.";
        if (setLocalMessage) setLocalMessage({ text: failure, ton: "fehler" });
        else setMessage(failure);
        return;
      }
      setLocalMessage?.(null);
      setMessage(success);
      after?.();
    });
  }

  function saveHourlyRate() {
    const value = Number(hourlyRateEuro.replace(",", "."));
    const hourlyRateCents = Math.round(value * 100);
    if (!Number.isFinite(value) || hourlyRateCents < 1 || hourlyRateCents > 1_000_000) {
      setMessage("Bitte einen gültigen Stundensatz zwischen 0,01 € und 10.000 € eingeben.");
      return;
    }
    startTransition(async () => {
      const execution = await runServerAction(() => setExtraWorkHourlyRateAction({
        rateId: crypto.randomUUID(),
        expectedVersion: hourlyRate.version,
        hourlyRateCents,
        clientEventId: crypto.randomUUID(),
      }), "Stundensatz speichern");
      if (!execution.ok) {
        setMessage(execution.message);
        return;
      }
      const result = execution.value;
      if (result.code !== "OK") return setMessage(result.message);
      setHourlyRate({ rateId: result.receipt.rateId, hourlyRateCents: result.receipt.hourlyRateCents, version: result.receipt.aggregateVersion });
      setHourlyRateEuro((result.receipt.hourlyRateCents / 100).toFixed(2).replace(".", ","));
      setMessage("Stundensatz Mehrarbeit gespeichert.");
    });
  }

  function saveCompany() {
    report(() => saveCompanySettingsAction(company), "Firmendaten gespeichert.");
  }

  function saveService() {
    startTransition(async () => {
      const execution = await runServerAction(
        () => saveCatalogServiceAction({ ...draft, id: draft.id || null }),
        "Leistung speichern",
      );
      if (!execution.ok) {
        setMessage(execution.message);
        return;
      }
      const result = execution.value;
      if (result.code !== "OK") return setMessage(result.message ?? "Speichern fehlgeschlagen.");
      setServices((current) => [...current.filter((item) => item.id !== result.service.id), result.service]);
      setDraft(emptyService());
      setMessage("Leistung gespeichert.");
    });
  }

  function createLogin() {
    startTransition(async () => {
      const execution = await runServerAction(() => createManagedUserAction(newLogin), "Login anlegen");
      if (!execution.ok) {
        setCreateLoginMessage({ text: execution.message, ton: "fehler" });
        return;
      }
      const result = execution.value;
      if (result.code !== "OK") {
        setCreateLoginMessage({ text: result.message ?? "Login konnte nicht angelegt werden.", ton: "fehler" });
        return;
      }
      setUsers((current) => [...current, result.user]);
      setNewLogin({ fullName: "", shortCode: "", designation: "", template: "werkstatt", pin: "" });
      setCreateLoginMessage(null);
      setCreateLoginOpen(false);
      setMessage("Login angelegt.");
    });
  }

  function updateUser(user: ManagedUser) {
    report(
      () => saveManagedUserAction({
        userId: user.id,
        fullName: user.fullName,
        shortCode: user.shortCode,
        designation: user.designation,
        active: user.active,
        pin: editPin || null,
      }),
      `${user.fullName} gespeichert.`,
      () => {
        setUsers((current) => current.map((item) => item.id === user.id ? user : item));
        setEditPin("");
        setEditingUser(null);
      },
      setEditUserMessage,
    );
  }

  function editUser(user: ManagedUser) {
    setEditingUser({ ...user, areas: [...user.areas], fixedAreas: [...user.fixedAreas] });
    setEditPin("");
    setEditUserMessage(null);
  }

  function renderUserCard(user: ManagedUser, inactive = false) {
    const isEditing = editingUser?.id === user.id;
    return <article key={user.id} className={inactive ? styles.inactiveUser : undefined}>
      <div className={styles.userSummary}>
        <span>{user.shortCode}</span>
        <div>
          <strong>{user.fullName}</strong>
          <small>{inactive
            ? [user.designation, "inaktiv"].filter(Boolean).join(" · ")
            : [user.designation, `${user.areas.length} Bereiche`].filter(Boolean).join(" · ")}</small>
        </div>
        {user.isCurrent ? <button data-spec-id="meincode.oeffnen" type="button" disabled={pending} onClick={() => { setOwnCodeMessage(null); setOwnCodeOpen(true); }}>Mein Code</button> : null}
        {canManageLogins ? <button data-spec-id="rechte.aendern" type="button" disabled={pending} onClick={() => editUser(user)}>Ändern</button> : null}
      </div>
      {canManageLogins && isEditing ? <div className={styles.userFields}>
        {editUserMessage ? <DialogAktionsmeldung meldung={editUserMessage} /> : null}
        <label>Name<input value={editingUser.fullName} onChange={(event) => setEditingUser({ ...editingUser, fullName: event.target.value })} /></label>
        <label>Kürzel<input value={editingUser.shortCode} maxLength={3} onChange={(event) => setEditingUser({ ...editingUser, shortCode: event.target.value.toUpperCase() })} /></label>
        <label>Bezeichnung (optional)<input value={editingUser.designation} onChange={(event) => setEditingUser({ ...editingUser, designation: event.target.value })} /></label>
        <label>Neuer Code<input type="password" inputMode="numeric" placeholder="unverändert" value={editPin} onChange={(event) => setEditPin(event.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
        <label className={styles.check}><input type="checkbox" checked={editingUser.active} disabled={editingUser.isCurrent} onChange={(event) => setEditingUser({ ...editingUser, active: event.target.checked })} />Aktiv</label>
        <button type="button" disabled={pending} onClick={() => updateUser(editingUser)}>Übernehmen</button>
        <button type="button" disabled={pending} onClick={() => { setEditingUser(null); setEditPin(""); setEditUserMessage(null); }}>Abbrechen</button>
      </div> : null}
    </article>;
  }

  function draftArea(userId: string, area: AccessArea, granted: boolean, isCurrent: boolean) {
    const persisted = users.find((user) => user.id === userId)?.areas.includes(area);
    if (persisted === undefined) return;
    setRightsMessage(null);
    setRightsToast(null);
    setRightChanges((current) => {
      const next = { ...current };
      const key = rightChangeKey(userId, area);
      if (granted === persisted) delete next[key];
      else next[key] = { userId, area, granted, isCurrent };
      return next;
    });
  }

  function saveRights() {
    const changes = Object.values(rightChanges).sort((left, right) => Number(left.isCurrent) - Number(right.isCurrent));
    if (changes.length === 0) return;
    setRightsMessage(null);
    setRightsToast(null);
    startTransition(async () => {
      const saved: RightChange[] = [];
      for (const change of changes) {
        const execution = await runServerAction(
          () => setManagedUserAreaAction({ userId: change.userId, area: change.area, granted: change.granted }),
          "Rechte speichern",
        );
        if (!execution.ok || execution.value.code !== "OK") {
          setUsers((current) => applyRightChanges(current, saved));
          setRightChanges((current) => {
            const next = { ...current };
            saved.forEach((item) => delete next[rightChangeKey(item.userId, item.area)]);
            return next;
          });
          setRightsMessage({
            text: execution.ok ? execution.value.message ?? "Rechte konnten nicht gespeichert werden." : execution.message,
            ton: "fehler",
          });
          return;
        }
        saved.push(change);
      }
      setUsers((current) => applyRightChanges(current, saved));
      setRightChanges({});
      setReloadAfterRightsSave(saved.some((change) => change.isCurrent));
      setRightsToast(saved.length === 1 ? "Recht gespeichert." : `${saved.length} Rechte gespeichert.`);
    });
  }

  function saveOwnCode() {
    if (!/^\d{4}$/.test(ownCode.first) || ownCode.first !== ownCode.repeat) {
      setOwnCodeMessage({ text: "Die Codes müssen übereinstimmen und genau 4 Ziffern haben.", ton: "fehler" });
      return;
    }
    report(() => changeOwnPinAction({ pin: ownCode.first }), "Neuer Code gespeichert", () => {
      setOwnCode({ first: "", repeat: "" });
      setOwnCodeOpen(false);
    }, setOwnCodeMessage);
  }

  return <main className={styles.page} data-testid="gregor-system-admin">
    <header><p>Einstellungen</p><h1>Arbeitsplatz & Zugänge</h1><span>Firmendaten, Leistungen und bestehende Zugänge</span></header>

    {(canManageCompany || canManageLogins || currentUser) ? <nav aria-label="Einstellungsbereiche">
      {canManageCompany ? <button aria-pressed={tab === "company"} onClick={() => setTab("company")}>Firmendaten</button> : null}
      {canManageCompany ? <button aria-pressed={tab === "catalog"} onClick={() => setTab("catalog")}>Leistungskatalog</button> : null}
      {(canManageLogins || currentUser) ? <button aria-pressed={tab === "users"} onClick={() => setTab("users")}>Logins & Rechte</button> : null}
    </nav> : null}
    {message ? <p role="status" className={styles.message}>{message}</p> : null}

    {canManageCompany && tab === "company" ? <section>
      <h2>Rechnungsabsender</h2>
      <div className={styles.setup} aria-label="Ersteinrichtung">
        <div><strong>Firmendaten</strong>{companyReady ? <span>vollständig</span> : <Link href="#company-data">fehlt – in Firmendaten eintragen</Link>}</div>
        <div><strong>Leistung mit Preis</strong><span>{catalogReady ? "vorhanden" : "noch offen"}</span></div>
        <div><strong>Stundensatz</strong><span>{rateReady ? "gespeichert" : "noch offen"}</span></div>
        {companyReady && catalogReady && rateReady && returnTo ? <Link href={returnTo}>Zurück zum vorherigen Vorgang</Link> : null}
      </div>
      <div id="company-data" className={styles.grid}>{field("companyName", "Firmenname")}{field("street", "Straße")}{field("zip", "PLZ")}{field("city", "Ort")}{field("country", "Land")}{field("taxId", "USt-ID / Steuernummer")}{field("iban", "IBAN")}{field("bic", "BIC")}{field("bankName", "Bank")}{field("paymentTermDays", "Zahlungsziel in Tagen", "number")}{field("logoUrl", "Logo-Pfad")}</div>
      <button disabled={pending} onClick={saveCompany}>Firmendaten speichern</button>
      <div id="extra-work-rate"><h3>Mehrarbeit</h3><div className={styles.grid}><label>Stundensatz Mehrarbeit (€/h)<input inputMode="decimal" value={hourlyRateEuro} onChange={(event) => setHourlyRateEuro(event.target.value)} placeholder="z. B. 85,00" /></label></div><button disabled={pending} onClick={saveHourlyRate}>Stundensatz speichern</button></div>
      <h3>Nummernkreise (systemverwaltet)</h3><dl className={styles.ranges}>{initialSnapshot.numberRanges.map((range) => <div key={range.label}><dt>{range.label}</dt><dd>{range.pattern}</dd></div>)}</dl>
    </section> : null}

    {canManageCompany && tab === "catalog" ? <section><h2>Leistungskatalog</h2><div className={styles.grid}>
      <label>Bezeichnung<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label>Oberfläche<input value={draft.surface} onChange={(event) => setDraft({ ...draft, surface: event.target.value })} /></label>
      <label>Einheit<input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} /></label>
      <label>Nettopreis (€)<input type="number" min="0" step="0.01" value={draft.netPriceCents / 100} onChange={(event) => setDraft({ ...draft, netPriceCents: Math.round(Number(event.target.value) * 100) })} /></label>
      <label>Steuersatz<select value={draft.vatRateBasisPoints} onChange={(event) => setDraft({ ...draft, vatRateBasisPoints: Number(event.target.value) as 0 | 700 | 1900 })}><option value="1900">19 %</option><option value="700">7 %</option><option value="0">0 %</option></select></label>
      <label>Standard-Durchlaufzeit<input type="number" min="0" max="365" value={draft.standardLeadTimeWorkingDays} onChange={(event) => setDraft({ ...draft, standardLeadTimeWorkingDays: Number(event.target.value) })} /></label>
      <label className={styles.check}><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Aktiv</label>
    </div><button disabled={pending} onClick={saveService}>Leistung speichern</button><div className={styles.list}>{services.map((service) => <button key={service.id} onClick={() => setDraft(service)}><strong>{service.name}</strong><span>{service.surface} · {(service.netPriceCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} / {service.unit}</span></button>)}</div></section> : null}

    {(canManageLogins || currentUser) && tab === "users" ? <section data-spec-id="rechte.dialog">
      <div className={styles.sectionHeading}><div><h2>Logins & Rechte</h2><p>{canManageLogins ? "Rechte auswählen und anschließend speichern." : "Ihr Zugang und Ihr persönlicher Code."}</p></div><Link data-spec-id="rechte.schliessen" href={returnTo ?? "/"}>Schließen</Link></div>
      {canManageLogins ? <div className={styles.createLogin}>
        {createLoginOpen ? <>
          <h3>Login anlegen</h3>
          {createLoginMessage ? <DialogAktionsmeldung meldung={createLoginMessage} /> : null}
          <label>Name<input data-spec-id="rechte.name" value={newLogin.fullName} onChange={(event) => setNewLogin({ ...newLogin, fullName: event.target.value, shortCode: suggestedShortCode(event.target.value) })} /></label>
          <label>Kürzel<input data-spec-id="rechte.kuerzel" value={newLogin.shortCode} maxLength={3} onChange={(event) => setNewLogin({ ...newLogin, shortCode: event.target.value.toUpperCase() })} /></label>
          <label>Bezeichnung (optional)<input data-spec-id="rechte.bezeichnung" value={newLogin.designation} onChange={(event) => setNewLogin({ ...newLogin, designation: event.target.value })} /></label>
          <label>Rechte wie<select data-spec-id="rechte.vorlage" value={newLogin.template} onChange={(event) => setNewLogin({ ...newLogin, template: event.target.value as typeof newLogin.template })}><option value="werkstatt">wie Werkstatt</option><option value="meister">wie Meister</option><option value="leer">leer</option></select></label>
          <label>Code<input data-spec-id="rechte.code" type="password" inputMode="numeric" value={newLogin.pin} onChange={(event) => setNewLogin({ ...newLogin, pin: event.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>
          <button data-spec-id="rechte.login-speichern" disabled={pending} onClick={createLogin}>Login speichern</button>
          <button type="button" disabled={pending} onClick={() => { setCreateLoginMessage(null); setCreateLoginOpen(false); }}>Abbrechen</button>
        </> : <button data-spec-id="rechte.login-anlegen" type="button" disabled={pending} onClick={() => { setCreateLoginMessage(null); setCreateLoginOpen(true); }}>Login anlegen</button>}
      </div> : null}
      <div className={styles.userList}>{activeUsers.map((user) => renderUserCard(user))}</div>
      {inactiveUsers.length > 0 ? <details className={styles.inactiveUsers}>
        <summary>Inaktive Logins ({inactiveUsers.length})</summary>
        <div className={styles.userList}>{inactiveUsers.map((user) => renderUserCard(user, true))}</div>
      </details> : null}
      {canManageLogins ? <div className={styles.rightsRegion} role="region" aria-label="Rechtematrix">{rightsMessage ? <DialogAktionsmeldung meldung={rightsMessage} /> : null}<div className={styles.rightsTable}><table><thead><tr><th>Bereich</th>{activeUsers.map((user) => <th key={user.id} aria-label={`${user.shortCode} ${user.fullName}`}><span className={styles.rightsPerson}><span>{user.shortCode}</span><strong>{user.fullName}</strong>{
        // eslint-disable-next-line h16/no-role-identity-comparison -- erlaubt H11c: Anzeige Einsicht & Systempflege
        user.role === "developer" ? <small>Einsicht & Systempflege</small> : null
      }</span></th>)}</tr></thead><tbody>{ACCESS_AREAS.map((area) => <tr key={area}><th><strong>{ACCESS_AREA_LABELS[area].text}</strong>{ACCESS_AREA_LABELS[area].sub ? <small>{ACCESS_AREA_LABELS[area].sub}</small> : null}</th>{activeUsers.map((user) => {
        const fixed = user.fixedAreas.includes(area);
        const blocked = !isAccessAreaAllowedForRole(user.role, area);
        const drafted = rightChanges[rightChangeKey(user.id, area)];
        const checked = drafted?.granted ?? user.areas.includes(area);
        return <td key={user.id} className={blocked ? styles.blockedRight : undefined}><input aria-label={`${ACCESS_AREA_LABELS[area].text} für ${user.fullName}`} type="checkbox" checked={!blocked && checked} disabled={pending || fixed || blocked} onChange={(event) => draftArea(user.id, area, event.target.checked, user.isCurrent)} />{blocked ? <small>{area === "wartung" ? "nur Entwickler" : "Entwickler, keine Geschäftsvorgänge"}</small> : fixed ? <small>fest</small> : null}</td>;
      })}</tr>)}</tbody></table></div><div className={styles.rightsActions}><span>{rightChangeCount === 0 ? "Keine ungespeicherten Änderungen" : rightChangeCount === 1 ? "1 Änderung noch nicht gespeichert" : `${rightChangeCount} Änderungen noch nicht gespeichert`}</span><button data-spec-id="rechte.rechte-speichern" aria-label="Rechte speichern" type="button" disabled={pending || rightChangeCount === 0} onClick={saveRights}>{pending ? "Rechte werden gespeichert …" : "Rechte speichern"}</button></div>{rightsToast ? <Toast text={rightsToast} /> : null}</div> : null}
    </section> : null}
    {ownCodeOpen ? <Dialog
      titel="Mein Code ändern"
      icon="lock"
      groesse="schmal"
      meldung={ownCodeMessage}
      onSchliessen={() => { setOwnCode({ first: "", repeat: "" }); setOwnCodeMessage(null); setOwnCodeOpen(false); }}
      fuss={<><button data-spec-id="meincode.abbrechen" type="button" onClick={() => { setOwnCode({ first: "", repeat: "" }); setOwnCodeMessage(null); setOwnCodeOpen(false); }}>Abbrechen</button><button data-spec-id="meincode.code-speichern" type="button" disabled={pending} onClick={saveOwnCode}>Code speichern</button></>}
    >
      <div className={styles.ownCode}>
        <p>Der neue Code gilt sofort. Andere Sitzungen dieses Logins werden beendet.</p>
        <label>Neuer Code<input data-spec-id="meincode.code_neu" type="password" inputMode="numeric" value={ownCode.first} onChange={(event) => setOwnCode((current) => ({ ...current, first: event.target.value.replace(/\D/g, "").slice(0, 4) }))} /></label>
        <label>Code wiederholen<input data-spec-id="meincode.code_wdh" type="password" inputMode="numeric" value={ownCode.repeat} onChange={(event) => setOwnCode((current) => ({ ...current, repeat: event.target.value.replace(/\D/g, "").slice(0, 4) }))} /></label>
      </div>
    </Dialog> : null}
  </main>;
}
