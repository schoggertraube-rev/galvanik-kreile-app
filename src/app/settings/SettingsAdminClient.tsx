"use client";

import Link from "next/link";
import {PAGE_READ_COPY,TODAY_MODEL_COPY} from "@/ui/situationCatalog";
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
  MAX_TODAY_REFRESH_MS,
  isAccessAreaAllowedForRole,
  type AccessArea,
  type CompanySettingsInput,
  type BetriebswaechterEinstellung,
  type ManagedUser,
  type SystemSettingsSnapshot,
} from "@/modules/fundament/public";
import type { CatalogService } from "@/modules/katalog/public";
import { orderPositionSurfaceLabel, orderPositionUnitLabel } from "@/lib/orderPositionContract";
import { runServerAction } from "@/lib/client/runServerAction";
import { Dialog, DialogAktionsmeldung, type DialogMeldung } from "@/ui/kr/Dialog";
import { Toast } from "@/ui/kr/Toast";
import styles from "./settings.module.css";
import { BETRIEBSWAECHTER_EINSTELLUNGEN_COPY, UMSATZSTEUER_EINSTELLUNG_COPY } from "@/ui/situationCatalog";
import { ShippingSettingsEditor } from "./ShippingSettingsEditor";
import {E_INVOICE_SETTINGS_COPY, LEISTUNG_DURCHLAUF_COPY} from '@/ui/situationCatalog';
import { EmailTemplatesEditor } from './EmailTemplatesEditor';

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

type Leistungsentwurf = Omit<CatalogService, "vatRateBasisPoints"> & { vatRateBasisPoints: number | null };

const emptyService = (): Leistungsentwurf => ({
  id: "",
  name: "",
  surface: "",
  unit: "Stück",
  netPriceCents: 0,
  vatRateBasisPoints: null,
  standardLeadTimeWorkingDays: null,
  active: true,
});

function suggestedShortCode(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts.map((part) => part[0]).join("").replace(/[^A-Za-zÄÖÜäöü0-9]/g, "").toUpperCase();
  return (initials || fullName.replace(/[^A-Za-zÄÖÜäöü0-9]/g, "").slice(0, 2).toUpperCase()).slice(0, 3);
}

function steuerProzent(wert:number|null|undefined):string{
  return wert==null?"":String(wert/100).replace(".",",");
}

function steuerBasispunkte(wert:string):number|null{
  const teile=/^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(wert.trim());
  if(!teile)return null;
  const satz=Number(teile[1])*100+Number((teile[2]??"").padEnd(2,"0"));
  return satz>0&&satz<=10000?satz:null;
}

const waechterGrenzen=[
  "sicherung_hoechstalter_stunden","wiederherstellungstest_hoechstalter_tage",
  "sicherung_min_prozent_vortag","dienst_ausfall_toleranz_stunden",
] as const;

function waechterFelder(stand:BetriebswaechterEinstellung|undefined){
  return {
    sicherungsort:stand?.sicherungsort??"",
    sicherung_hoechstalter_stunden:String(stand?.sicherung_hoechstalter_stunden??""),
    wiederherstellungstest_hoechstalter_tage:String(stand?.wiederherstellungstest_hoechstalter_tage??""),
    sicherung_min_prozent_vortag:String(stand?.sicherung_min_prozent_vortag??""),
    dienst_ausfall_toleranz_stunden:String(stand?.dienst_ausfall_toleranz_stunden??""),
  };
}

export function SettingsAdminClient({
  initialSnapshot,
  initialServices,
  catalogLocked,
  returnTo = null,
}: {
  initialSnapshot: SystemSettingsSnapshot;
  initialServices: CatalogService[];
  catalogLocked: string | null;
  returnTo?: string | null;
}) {
  const [rebuildingToday,setRebuildingToday]=useState(false);
  const { canManageCompany, canManageLogins } = initialSnapshot.capabilities ?? {
    canManageCompany: true,
    canManageLogins: true,
    canManageSystem: true,
  };
  const canManageFinancial = initialSnapshot.capabilities?.canManageFinancial === true;
  const [tab, setTab] = useState<Tab>(
    canManageCompany ? "company" : canManageLogins || initialSnapshot.users.some((user) => user.isCurrent) ? "users" : "company",
  );
  const [akzentBasis, setAkzentBasis] = useState(initialSnapshot.company.akzentfarbe);
  const [akzentfarbe, setAkzentfarbe] = useState(akzentBasis);
  const [ruheBasis, setRuheBasis] = useState(initialSnapshot.company.betriebsruhe);
  const [betriebsruhe, setBetriebsruhe] = useState(ruheBasis);
  const [waechterBasis,setWaechterBasis]=useState(initialSnapshot.company.betriebswaechter);
  const [waechter,setWaechter]=useState(()=>waechterFelder(waechterBasis));
  const [empfaengerBasis,setEmpfaengerBasis]=useState(initialSnapshot.company.empfaenger);
  const [steuerberater,setSteuerberater]=useState(empfaengerBasis?.steuerberater??"");
  const [bankEmpfaenger,setBankEmpfaenger]=useState(empfaengerBasis?.bank??"");
  const [steuerBasis,setSteuerBasis]=useState(initialSnapshot.company.umsatzsteuer);
  const [regelSatz,setRegelSatz]=useState(()=>steuerProzent(steuerBasis?.regelsatzBasispunkte));
  const [ermaessigterSatz,setErmaessigterSatz]=useState(()=>steuerProzent(steuerBasis?.ermaessigtBasispunkte));
  const [ausschussBasis, setAusschussBasis] = useState(initialSnapshot.company.ausschussBerechnen);
  const [ausschussBerechnen, setAusschussBerechnen] = useState(ausschussBasis);
  const [company, setCompany] = useState<CompanySettingsInput>({
    companyName: initialSnapshot.company.companyName ?? "",
    street: initialSnapshot.company.street ?? "",
    zip: initialSnapshot.company.zip ?? "",
    city: initialSnapshot.company.city ?? "",
    country: initialSnapshot.company.country ?? "",
    taxId: initialSnapshot.company.taxId ?? "",
    taxNumber: initialSnapshot.company.taxNumber ?? "",
    iban: initialSnapshot.company.iban ?? "",
    bic: initialSnapshot.company.bic ?? "",
    bankName: initialSnapshot.company.bankName ?? "",
    paymentTermDays: initialSnapshot.company.paymentTermDays ?? 0,
    logoUrl: initialSnapshot.company.logoUrl ?? "",
    ...(initialSnapshot.company.pageReadsSchemaReady===true&&initialSnapshot.company.pageReads?{pageReads:initialSnapshot.company.pageReads}:{}),
    ...(typeof initialSnapshot.company.todayRefreshLeaseSeconds==='number'?{todayRefreshLeaseSeconds:initialSnapshot.company.todayRefreshLeaseSeconds}:{}),
  });
  const [services, setServices] = useState(initialServices);
  const [draft, setDraft] = useState(emptyService());
  const katalogSteuersatz = draft.vatRateBasisPoints ?? steuerBasis?.regelsatzBasispunkte ?? null;
  const katalogSteuersaetze = [...new Set([steuerBasis?.regelsatzBasispunkte, steuerBasis?.ermaessigtBasispunkte, 0])]
    .filter((satz): satz is number => satz != null && [0, 700, 1900].includes(satz));
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
  const catalogReady = catalogLocked === null && services.length > 0;
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
    <label>{label}<input id={`company-${key}`} type={type} value={String(company[key])} onChange={(event) => setCompany((current) => ({ ...current, [key]: type === "number" ? Number(event.target.value) : event.target.value }))} /></label>
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
    const alter=waechterFelder(waechterBasis);
    const waechterGeaendert=waechterBasis&&(waechter.sicherungsort.trim()!==alter.sicherungsort
      ||waechterGrenzen.some(feld=>waechter[feld]!==alter[feld]));
    if(waechterGeaendert&&waechterGrenzen.some(feld=>!/^\d+$/.test(waechter[feld])||Number(waechter[feld])<1
      ||Number(waechter[feld])>(feld==="sicherung_min_prozent_vortag"?100:2_147_483_647))){
      setMessage(BETRIEBSWAECHTER_EINSTELLUNGEN_COPY.ungueltig);
      return;
    }
    const waechterNeu={
      sicherungsort:waechter.sicherungsort.trim()||null,
      sicherung_hoechstalter_stunden:Number(waechter.sicherung_hoechstalter_stunden),
      wiederherstellungstest_hoechstalter_tage:Number(waechter.wiederherstellungstest_hoechstalter_tage),
      sicherung_min_prozent_vortag:Number(waechter.sicherung_min_prozent_vortag),
      dienst_ausfall_toleranz_stunden:Number(waechter.dienst_ausfall_toleranz_stunden),
    };
    const waechterwechsel=waechterBasis&&waechterGeaendert
      ? {betriebswaechter:{vorher:waechterBasis,neu:waechterNeu}} : {};
    const empfaengerNeu={steuerberater:steuerberater.trim()||null,bank:bankEmpfaenger.trim()||null};
    const empfaengerwechsel=empfaengerBasis&&(empfaengerNeu.steuerberater!==empfaengerBasis.steuerberater
      ||empfaengerNeu.bank!==empfaengerBasis.bank) ? {empfaenger:{vorher:empfaengerBasis,neu:empfaengerNeu}} : {};
    const steuerGeaendert=steuerBasis&&(regelSatz!==steuerProzent(steuerBasis.regelsatzBasispunkte)
      ||ermaessigterSatz!==steuerProzent(steuerBasis.ermaessigtBasispunkte));
    const regel=steuerBasispunkte(regelSatz),ermaessigt=steuerBasispunkte(ermaessigterSatz);
    if(steuerGeaendert&&(regel===null||ermaessigt===null||ermaessigt>=regel)){
      setMessage(UMSATZSTEUER_EINSTELLUNG_COPY.ungueltig);
      return;
    }
    const steuerwechsel=steuerBasis&&steuerGeaendert&&regel!==null&&ermaessigt!==null
      ? {umsatzsteuer:{vorher:steuerBasis,neu:{regelsatzBasispunkte:regel,ermaessigtBasispunkte:ermaessigt}}} : {};
    report(async () => {
      const geaendert = akzentfarbe && akzentBasis && akzentfarbe !== akzentBasis
        ? { akzentfarbe: { vorher: akzentBasis, neu: akzentfarbe } } : {};
      const ruhewechsel = betriebsruhe && ruheBasis && betriebsruhe !== ruheBasis
        ? { betriebsruhe: { vorher: ruheBasis, neu: betriebsruhe } } : {};
      const ausschusswechsel = typeof ausschussBerechnen === "boolean" && typeof ausschussBasis === "boolean"
        && ausschussBerechnen !== ausschussBasis
        ? { ausschussBerechnen: { vorher: ausschussBasis, neu: ausschussBerechnen } } : {};
      const result = await saveCompanySettingsAction({ ...company, ...geaendert, ...ruhewechsel, ...ausschusswechsel, ...steuerwechsel, ...empfaengerwechsel, ...waechterwechsel });
      if(result.code==="OK"&&result.betriebswaechter){
        setWaechterBasis(result.betriebswaechter);
        setWaechter(waechterFelder(result.betriebswaechter));
      }
      if(result.code==="OK"&&result.empfaenger){
        setEmpfaengerBasis(result.empfaenger);
        setSteuerberater(result.empfaenger.steuerberater??"");
        setBankEmpfaenger(result.empfaenger.bank??"");
      }
      if(result.code==="OK"&&result.umsatzsteuer){
        setSteuerBasis(result.umsatzsteuer);
        setRegelSatz(steuerProzent(result.umsatzsteuer.regelsatzBasispunkte));
        setErmaessigterSatz(steuerProzent(result.umsatzsteuer.ermaessigtBasispunkte));
      }
      if (result.code === "OK" && typeof result.ausschussBerechnen === "boolean") {
        setAusschussBasis(result.ausschussBerechnen);
        setAusschussBerechnen(result.ausschussBerechnen);
      }
      if (result.code === "OK" && result.betriebsruhe) {
        setRuheBasis(result.betriebsruhe);
        setBetriebsruhe(result.betriebsruhe);
      }
      if (result.code === "OK" && result.akzentfarbe) {
        setAkzentBasis(result.akzentfarbe);
        setAkzentfarbe(result.akzentfarbe);
      }
      return result;
    }, "Firmendaten gespeichert.");
  }

  function saveService() {
    if (katalogSteuersatz === null || !katalogSteuersaetze.includes(katalogSteuersatz)) return;
    startTransition(async () => {
      const execution = await runServerAction(
        () => saveCatalogServiceAction({ ...draft, id: draft.id || null, vatRateBasisPoints: katalogSteuersatz }),
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
    {initialSnapshot.capabilities?.canManageSystem===true?<button type="button" disabled={rebuildingToday} onClick={async()=>{
      if(rebuildingToday)return;
      setRebuildingToday(true);setMessage(TODAY_MODEL_COPY.rebuildRunning);
      try{
        const response=await fetch('/api/heute/neuaufbau',{credentials:'same-origin',cache:'no-store'});
        setMessage(response.status===204?TODAY_MODEL_COPY.rebuildDone:response.status===409?TODAY_MODEL_COPY.rebuildRunning:PAGE_READ_COPY.sourceIncomplete);
      }catch{setMessage(PAGE_READ_COPY.sourceIncomplete);}
      finally{setRebuildingToday(false);}
    }}>{TODAY_MODEL_COPY.rebuildButton}</button>:null}

    {(canManageCompany || canManageLogins || currentUser) ? <nav aria-label="Einstellungsbereiche">
      {canManageCompany ? <button aria-pressed={tab === "company"} onClick={() => setTab("company")}>Firmendaten</button> : null}
      {canManageCompany && canManageFinancial ? <button aria-pressed={tab === "catalog"} onClick={() => setTab("catalog")}>Leistungskatalog</button> : null}
      {(canManageLogins || currentUser) ? <button aria-pressed={tab === "users"} onClick={() => setTab("users")}>Logins & Rechte</button> : null}
    </nav> : null}
    {message ? <p role="status" className={styles.message}>{message}</p> : null}

    {canManageCompany && tab === "company" ? <section>
      <h2>Rechnungsabsender</h2>
      <div className={styles.setup} aria-label="Ersteinrichtung">
        <div><strong>Firmendaten</strong>{companyReady ? <span>vollständig</span> : <Link href="#company-data">fehlt – in Firmendaten eintragen</Link>}</div>
        {canManageFinancial ? <div><strong>Leistung mit Preis</strong><span>{catalogReady ? "vorhanden" : "noch offen"}</span></div> : null}
        {canManageFinancial ? <div><strong>Stundensatz</strong><span>{rateReady ? "gespeichert" : "noch offen"}</span></div> : null}
        {companyReady && (!canManageFinancial || catalogReady && rateReady) && returnTo ? <Link href={returnTo}>Zurück zum vorherigen Vorgang</Link> : null}
      </div>
      <div id="company-data" className={styles.grid}>{field("companyName", E_INVOICE_SETTINGS_COPY.fieldLabels.companyName)}{field("street", E_INVOICE_SETTINGS_COPY.fieldLabels.street)}{field("zip", E_INVOICE_SETTINGS_COPY.fieldLabels.zip)}{field("city", E_INVOICE_SETTINGS_COPY.fieldLabels.city)}{field("country", E_INVOICE_SETTINGS_COPY.fieldLabels.country)}{field("taxId", E_INVOICE_SETTINGS_COPY.fieldLabels.taxId)}{field("taxNumber", E_INVOICE_SETTINGS_COPY.fieldLabels.taxNumber)}{field("iban", E_INVOICE_SETTINGS_COPY.fieldLabels.iban)}{field("bic", E_INVOICE_SETTINGS_COPY.fieldLabels.bic)}{field("bankName", E_INVOICE_SETTINGS_COPY.fieldLabels.bankName)}{field("paymentTermDays", E_INVOICE_SETTINGS_COPY.fieldLabels.paymentTermDays, "number")}{field("logoUrl", E_INVOICE_SETTINGS_COPY.fieldLabels.logoUrl)}</div>
      <div className={styles.grid}>
        <label>{PAGE_READ_COPY.timeout}<input type="number" min="1" disabled={initialSnapshot.company.pageReadsSchemaReady!==true} value={company.pageReads?.queryTimeoutMs??''} onChange={event=>setCompany(current=>current.pageReads?{...current,pageReads:{...current.pageReads,queryTimeoutMs:Number(event.target.value)}}:current)}/></label>
        <label>{PAGE_READ_COPY.refreshLeaseLabel}<input type="number" min="1" max={MAX_TODAY_REFRESH_MS/1000} disabled={pending} value={company.todayRefreshLeaseSeconds??''} onChange={event=>setCompany(current=>({...current,todayRefreshLeaseSeconds:Number(event.target.value)}))}/></label>
      </div>
      {initialSnapshot.company.pageReadsSchemaReady!==true?<p role="status">{PAGE_READ_COPY.settingsPending}</p>:null}
      {canManageFinancial&&steuerBasis?<div className={styles.grid}>
        <label>{UMSATZSTEUER_EINSTELLUNG_COPY.regelsatz}<input inputMode="decimal" maxLength={6} disabled={pending}
          value={regelSatz} onChange={event=>setRegelSatz(event.currentTarget.value)}/></label>
        <label>{UMSATZSTEUER_EINSTELLUNG_COPY.ermaessigt}<input inputMode="decimal" maxLength={6} disabled={pending}
          value={ermaessigterSatz} onChange={event=>setErmaessigterSatz(event.currentTarget.value)}/></label>
      </div>:null}
      <button disabled={pending} onClick={saveCompany}>Firmendaten speichern</button>
      <ShippingSettingsEditor />
      {canManageFinancial ? <div id="extra-work-rate"><h3>Mehrarbeit</h3><div className={styles.grid}><label>Stundensatz Mehrarbeit (€/h)<input inputMode="decimal" value={hourlyRateEuro} onChange={(event) => setHourlyRateEuro(event.target.value)} placeholder="z. B. 85,00" /></label></div><button disabled={pending} onClick={saveHourlyRate}>Stundensatz speichern</button></div> : null}
      <h3>Nummernkreise (systemverwaltet)</h3><dl className={styles.ranges}>{initialSnapshot.numberRanges.map((range) => <div key={range.label}><dt>{range.label}</dt><dd>{range.pattern}</dd></div>)}</dl>
    </section> : null}

    {canManageCompany?<div hidden={tab!=="company"}><EmailTemplatesEditor /></div>:null}
    {canManageCompany && canManageFinancial && tab === "catalog" ? <section><h2>Leistungskatalog</h2><div className={styles.grid}>
      <label>Bezeichnung<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label>Oberfläche<input value={draft.surface} onChange={(event) => setDraft({ ...draft, surface: event.target.value })} /></label>
      <label>Einheit<input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} /></label>
      <label>Nettopreis (€)<input type="number" min="0" step="0.01" value={draft.netPriceCents / 100} onChange={(event) => setDraft({ ...draft, netPriceCents: Math.round(Number(event.target.value) * 100) })} /></label>
      <label>Steuersatz<select value={katalogSteuersatz ?? ""} onChange={event => setDraft({ ...draft,
        vatRateBasisPoints: event.target.value === "" ? null : Number(event.target.value) })}>
        {katalogSteuersatz === null ? <option value="" disabled>{UMSATZSTEUER_EINSTELLUNG_COPY.katalogRegelsatzFehlt}</option> : null}
        {katalogSteuersatz !== null && !katalogSteuersaetze.includes(katalogSteuersatz)
          ? <option value={katalogSteuersatz} disabled>{steuerProzent(katalogSteuersatz)} % – {UMSATZSTEUER_EINSTELLUNG_COPY.katalogSatzNochNichtUnterstuetzt}</option> : null}
        {katalogSteuersaetze.map(satz => <option key={satz} value={satz}>{steuerProzent(satz)} %</option>)}
      </select></label>
      <label>{LEISTUNG_DURCHLAUF_COPY.label}<input type="number" min="0" max="365" placeholder={LEISTUNG_DURCHLAUF_COPY.fehlt}
        value={draft.standardLeadTimeWorkingDays ?? ""} onChange={(event) => setDraft({ ...draft,
          standardLeadTimeWorkingDays: event.target.value === "" ? null : Number(event.target.value) })} /></label>
      <label className={styles.check}><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Aktiv</label>
    </div><button disabled={pending || katalogSteuersatz === null || !katalogSteuersaetze.includes(katalogSteuersatz)} onClick={saveService}>Leistung speichern</button><div className={styles.list}>{services.map((service) => <button key={service.id} onClick={() => setDraft({...service,surface:orderPositionSurfaceLabel(service.surface),unit:orderPositionUnitLabel(service.unit)})}><strong>{service.name}</strong><span>{orderPositionSurfaceLabel(service.surface)} · {(service.netPriceCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} / {orderPositionUnitLabel(service.unit)}</span></button>)}</div></section> : null}

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
        // erlaubt H11c: Anzeige Einsicht & Systempflege
        user.role === "developer" ? <small>Einsicht & Systempflege</small> : null
      }</span></th>)}</tr></thead><tbody>{ACCESS_AREAS.filter(area=>area!=='statistik_alle').map((area) => <tr key={area}><th><strong>{ACCESS_AREA_LABELS[area].text}</strong>{ACCESS_AREA_LABELS[area].sub ? <small>{ACCESS_AREA_LABELS[area].sub}</small> : null}</th>{activeUsers.map((user) => {
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
