"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Auswahl, Button, Eingabe, Feld, FormRaster, Hinweis, Icon, Segment, Textfeld } from "@/ui/kr";
import {
  CUSTOMER_COUNTRIES,
  applyCustomerTypeChange,
  kundeValidierung,
  customerTypeChangeLosses,
  type CustomerFormType,
  type CustomerFormValue,
} from "../customerFormContract";

import {customerPaymentLabel} from "../paymentPreferenceContract";

type CustomerField = keyof CustomerFormValue;

export function KundeFormular({
  value,
  onChange,
  prefix,
  canManageMoney,
  invoiceTermsEnabled = false,
  invoiceTermDays = null,
  mode,
  autofocusField,
  addressMessage,
  addressSuggestions,
  supplierMode = false,
  canDecide = false,
  previous,
  errors,
  origins,
  proposals,
  onAcceptProposal,
  priorityFields = [],
  onlyFields,
}: {
  value: CustomerFormValue;
  onChange: (value: CustomerFormValue) => void;
  prefix: "kundeneu" | "kundebearbeiten" | "eingang";
  canManageMoney: boolean;
  invoiceTermsEnabled?: boolean;
  invoiceTermDays?: number | null;
  mode: "create" | "edit" | "inline";
  onlyFields?:readonly CustomerField[];
  supplierMode?: boolean;
  canDecide?: boolean;
  previous?: CustomerFormValue;
  errors?: Partial<Record<keyof CustomerFormValue,string>>;
  origins?:Partial<Record<keyof CustomerFormValue,string>>;
  proposals?:Partial<CustomerFormValue>;
  onAcceptProposal?:(field:keyof CustomerFormValue,next:CustomerFormValue[keyof CustomerFormValue])=>void;
  autofocusField?: CustomerField | null;
  priorityFields?: readonly CustomerField[];
  addressSuggestions?:Array<{zipCode:string;city:string;street:string|null}>;
  addressMessage?: { tone: "ok" | "warn" | "neutral"; text: string } | null;
}) {
  const [touched, setTouched] = useState<Set<CustomerField>>(new Set());
  const [pendingType, setPendingType] = useState<Exclude<CustomerFormType, ""> | null>(null);
  const [losses, setLosses] = useState<string[]>([]);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!autofocusField)return;
    const target=root.current?.querySelector<HTMLElement>(`[data-spec-id="${prefix}.${fieldSpecId(autofocusField)}"]`);
    const frame=requestAnimationFrame(()=>{const focusTarget=target?.matches("input,textarea,select,button")?target:target?.querySelector<HTMLElement>("input,textarea,select,button");focusTarget?.focus();});
    return()=>cancelAnimationFrame(frame);
  },[autofocusField,prefix]);
  const types = useMemo(() => supplierMode && mode === "create" ? [{ wert: "lieferant" as const, text: "Lieferant" }] : [
    { wert: "business" as const, text: "Firma" },
    { wert: "privat" as const, text: "Privat" },
    ...(canManageMoney && mode === "edit" ? [{ wert: "lieferant" as const, text: "Lieferant" }] : []),
  ], [canManageMoney, mode, supplierMode]);

  const set = <K extends CustomerField>(key: K, next: CustomerFormValue[K]) => onChange({ ...value, [key]: next });
  const blur = (field: CustomerField) => setTouched((current) => new Set(current).add(field));
  const validation = kundeValidierung(value,previous,{invoiceTermsEnabled});
  const error = (field: CustomerField) => errors?.[field] ?? (touched.has(field) ? validation[field] : null);
  const metadata=(key:CustomerField)=> <>
    {origins?.[key]?<small data-spec-id={`${prefix}.${fieldSpecId(key)}.herkunft`}>{origins[key]}</small>:null}
    {proposals?.[key]!==undefined&&proposals[key]!==value[key]?<div><span>neu: {typeof proposals[key]==="boolean"?proposals[key]?"Ja":"Nein":String(proposals[key])} · bisher: {String(value[key])}</span><Button data-spec-id={`${prefix}.${fieldSpecId(key)}.uebernehmen`} text="Übernehmen" onClick={()=>{if(key==="customerType")requestType(proposals[key] as CustomerFormType);else onAcceptProposal?.(key,proposals[key]!)}}/></div>:null}
  </>;
  const fieldNodes = new Map<CustomerField, ReactNode>();
  const place = (key: CustomerField, node: ReactNode) => {
    fieldNodes.set(key, node);
    return mode === "edit" && priorityFields.includes(key) ? null : node;
  };
  const field = (
    key: Exclude<CustomerField, "customerType" | "autoInfo" | "vorrang">,
    label: string,
    options: { type?: "text" | "email" | "tel" | "number"; full?: boolean; required?: boolean; forOrder?: boolean; maxLength?: number } = {},
  ) => place(key, <Feld label={<>{label}{options.required ? <> <small aria-hidden="true" className="ev-pflicht">Pflicht</small></> : options.forOrder ? <> <small aria-hidden="true" className="ev-pflicht ev-pflicht--fuer_auftrag">für Auftrag</small></> : null}</>} voll={options.full} className={origins?.[key]?.startsWith("erkannt") ? "ev-feld--neu" : undefined}>
    <Eingabe
      data-spec-id={`${prefix}.${fieldSpecId(key)}`}
      aria-label={label}
      autoFocus={autofocusField === key}
      type={options.type}
      required={options.required}
      maxLength={options.maxLength}
      value={String(value[key] ?? "")}
      onChange={(event) => set(key, event.target.value as CustomerFormValue[typeof key])}
      onBlur={() => blur(key)}
    />
    {error(key) ? <span data-spec-id={`${prefix}.${fieldSpecId(key)}.fehler`} role="alert">{error(key)}</span> : null}
    {metadata(key)}
  </Feld>);

  const requestType = (target: CustomerFormType) => {
    if (!target || target === value.customerType) return;
    const removed = customerTypeChangeLosses(value, target);
    if (removed.length) {
      setPendingType(target);
      setLosses(removed);
      return;
    }
    onChange(applyCustomerTypeChange(value, target));
  };

  const applyType = () => {
    if (!pendingType) return;
    onChange(applyCustomerTypeChange(value, pendingType));
    setPendingType(null);
    setLosses([]);
  };

  const isBusiness = value.customerType === "business";
  const isPrivate = value.customerType === "privat";
  const isSupplier = value.customerType === "lieferant";
  const paymentOptions = [
    { wert: "vorkasse", text: "Vorkasse" },
    { wert: "bar", text: "Bar oder Karte bei Abholung" },
    ...(invoiceTermsEnabled && invoiceTermDays
      ? [{ wert: "rechnung", text: customerPaymentLabel("rechnung",{invoiceTermDays}) }]
      : []),
  ];
  const paymentValue = paymentOptions.some(option => option.wert === value.paymentPreference) ? value.paymentPreference : "";
  if (!paymentValue) paymentOptions.unshift({ wert: "", text: "Bitte wählen" });
  const countryOptions = [...(!value.country ? [{ wert: "", text: "Bitte wählen" }] : []), ...CUSTOMER_COUNTRIES.map(option => ({wert: option.value,text: option.label}))];

  const customerType = <div className="ev-kf-typ">
    <span className="ev-kf-typ-l">{supplierMode && mode === "create" ? "Lieferant" : "Firma oder Privat?"} <small aria-hidden="true" className="ev-pflicht">Pflicht</small></span>
    <div className="ev-kf-typ-k" role="group" aria-label="Kundentyp" data-spec-id={`${prefix}.kundentyp`} tabIndex={-1}>
      {types.map(type => <button key={type.wert} type="button" className="ev-kf-typ-b" aria-label={type.text} aria-pressed={value.customerType === type.wert} onClick={() => requestType(type.wert)}>
        <Icon name={type.wert === "privat" ? "user" : type.wert === "lieferant" ? "truck" : "grid"} />
        <b>{type.text}</b><small>{type.wert === "privat" ? "Vor- und Nachname" : type.wert === "lieferant" ? "Firma · Anschrift · Zahlungsziel" : "Firmenname · Ansprechpartner · USt-ID"}</small>
      </button>)}
    </div>
    {metadata("customerType")}
  </div>;
  const person = <>
    {(isBusiness || isSupplier) ? field("companyName", "Firmenname", { full: mode === "edit", required: true, maxLength: 160 }) : null}
    {(isBusiness || isSupplier) ? <div className="ev-kf-unter">Ansprechpartner</div> : null}
    {value.customerType ? <Feld label="Anrede" className="ev-kf-anr"><div data-spec-id={`${prefix}.anrede`}><Segment label="Anrede" wert={value.salutation} optionen={[
      { wert: "frau", text: "Frau" }, { wert: "herr", text: "Herr" }, { wert: "ohne", text: "ohne" },
    ]} onWert={(next) => set("salutation", next)} /></div>{metadata("salutation")}</Feld> : null}
    {value.customerType ? field("firstName", "Vorname", { forOrder: isPrivate, maxLength: 60 }) : null}
    {value.customerType ? field("lastName", "Nachname", { required: isPrivate, forOrder: isBusiness, maxLength: 80 }) : null}
    {(isBusiness || isSupplier) ? field("contactRole", "Funktion / Abteilung", { maxLength: 60 }) : null}
  </>;
  const contact = <>
    {field("phone", "Telefon", { type: "tel", required: !isSupplier, maxLength: 20 })}
    {field("email", "E-Mail", { type: "email", forOrder: !isSupplier, maxLength: 254 })}
    {isBusiness ? field("billingEmail", "E-Mail für Rechnungen", { type: "email", maxLength: 254 }) : null}
  </>;
  const address = value.customerType ? <div className="kr-voll kr-form" data-spec-id={`${prefix}.adresse`} tabIndex={-1}>
    {field("street", "Straße", { forOrder: !isSupplier, maxLength: 120 })}
    {field("houseNumber", "Nr.", { forOrder: !isSupplier, maxLength: 10 })}
    {field("zipCode", "PLZ", { forOrder: !isSupplier, maxLength: 10 })}
    {field("city", "Ort", { forOrder: !isSupplier, maxLength: 100 })}
    {place("country", <Feld label="Land"><Auswahl data-spec-id={`${prefix}.land`} value={value.country} onChange={(event) => set("country", event.target.value)} onBlur={() => blur("country")} optionen={countryOptions} />{metadata("country")}{error("country") ? <span role="alert">{error("country")}</span> : null}</Feld>)}
    {addressMessage ? <div className={`ev-kf-adr ev-kf-adr--${addressMessage.tone === "ok" ? "ok" : addressMessage.tone === "warn" ? "warn" : "grau"}`} role="status">
      <Icon name={addressMessage.tone === "ok" ? "check" : "alert"} /><span>{addressMessage.text}</span>
      {addressSuggestions?.map((suggestion, index) => <Button key={`${suggestion.zipCode}:${suggestion.city}:${suggestion.street}`} data-spec-id={`${prefix}.adresse.uebernehmen${index || ""}`} text={`${suggestion.city} · ${suggestion.street ?? "Straße fehlt"} übernehmen`} onClick={() => onChange({ ...value, zipCode: suggestion.zipCode, city: suggestion.city, ...(suggestion.street ? { street: suggestion.street } : {}) })} />)}
    </div> : null}
  </div> : null;
  const payment = value.customerType ? <>
    {canManageMoney && !isSupplier ? place("paymentPreference", <Feld label="Zahlungsbedingung"><Auswahl data-spec-id={`${prefix}.zahlungsbedingung`} value={paymentValue} style={paymentValue ? { backgroundColor: "var(--succ)", color: "var(--surface)" } : undefined} onChange={(event) => set("paymentPreference", event.target.value)} optionen={paymentOptions} />{metadata("paymentPreference")}</Feld>) : null}
    {!isSupplier ? <Feld label="Übergabe bevorzugt"><div data-spec-id={`${prefix}.uebergabe`}><Segment label="Übergabe bevorzugt" wert={value.handoverPreference} optionen={[
      { wert: "pickup", text: "Abholung" }, { wert: "shipping", text: "Versand" },
    ]} onWert={(next) => set("handoverPreference", next)} /></div>{metadata("handoverPreference")}</Feld> : null}
    {isSupplier ? field("iban", "IBAN", { maxLength: 34 }) : null}
    {isSupplier ? field("paymentTermDays", "Zahlungsziel (Tage)", { type: "number" }) : null}
  </> : null;
  const more = value.customerType ? <>
    {isBusiness ? field("vatId", "USt-ID", { maxLength: 20 }) : null}
    {(isBusiness || isSupplier) ? field("website", "Website", { maxLength: 120 }) : null}
    {mode!=="inline"?<Feld label="Notiz / Telefonnotiz" voll><Textfeld data-spec-id={`${prefix}.notiz`} rows={3} maxLength={2000} value={value.notes} onChange={(event) => set("notes", event.target.value)} onBlur={() => blur("notes")} />{metadata("notes")}</Feld>:null}
  </> : null;
  const defaults = mode!=="inline" && !isSupplier && value.customerType ? <section className="kr-stapel" aria-label="Standard für Aufträge">
    <h4 className="ev-kf-unter">Standard für Aufträge</h4>
    <FormRaster>
      <Feld label="Kunde automatisch informieren"><div data-spec-id={`${prefix}.auto_info`}><Segment label="Kunde automatisch informieren" wert={value.autoInfo ? "ja" : "nein"} optionen={[{ wert: "ja", text: "Ja" }, { wert: "nein", text: "Nein" }]} onWert={next => set("autoInfo", next === "ja")} /></div>{metadata("autoInfo")}</Feld>
      {mode === "edit" ? <Feld label="Vorrang bei Terminen"><div data-spec-id={`${prefix}.vorrang`}><Segment label="Vorrang bei Terminen" wert={value.vorrang ? "ja" : "nein"} optionen={[{ wert: "ja", text: "Ja", gesperrt: !canDecide }, { wert: "nein", text: "Nein", gesperrt: !canDecide }]} onWert={next => set("vorrang", next === "ja")} />{!canDecide ? <span>nur Meister</span> : null}</div>{metadata("vorrang")}</Feld> : null}
    </FormRaster>
  </section> : null;
  const section = (number: number, title: string, children: ReactNode) => <section className="kr-abschnitt" aria-label={title}>
    <h3 className="ev-abs-kopf"><span className="ev-nrkreis">{number}</span>{title}</h3><FormRaster>{children}</FormRaster>
  </section>;

  return <div ref={root} className="kr-stapel" data-spec-id={mode==="inline"?`${prefix}.kundenfelder`:prefix} onKeyDownCapture={event => { if (pendingType && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); setPendingType(null); setLosses([]); } }}>
    {pendingType ? <Hinweis ton="warn"><div className="kr-stapel" data-spec-id={`${prefix}.zustand.typwechsel`}>
      <strong>{losses.length} Angaben entfallen: {losses.join(", ")} – wechseln?</strong>
      <div className="kr-schnellleiste"><Button data-spec-id={`${prefix}.typ-wechseln`} art="primaer" text="Wechseln" onClick={applyType} /><Button data-spec-id={`${prefix}.typ-wechsel-abbrechen`} text="Abbrechen" onClick={() => { setPendingType(null); setLosses([]); }} /></div>
    </div></Hinweis> : null}
    {mode === "edit" && priorityFields.length ? <section className="kr-stapel" aria-label="Für Aufträge ergänzen"><h3 className="ev-kf-unter">Für Aufträge ergänzen</h3><FormRaster>{priorityFields.map(key => <Fragment key={key}>{fieldNodes.get(key)}</Fragment>)}</FormRaster></section> : null}
    {onlyFields ? <FormRaster>{onlyFields.map(key=><Fragment key={key}>{fieldNodes.get(key)}</Fragment>)}</FormRaster> : mode === "create" ? <>
      {section(1, "Wer?", <>{customerType}{person}</>)}
      {section(2, "Kontakt", contact)}
      {value.customerType ? <>
        {section(3, "Anschrift", address)}
        {section(4, isSupplier ? "Lieferant" : "Zahlung", payment)}
        {section(5, "Ansprechpartner, Website, Notiz", more)}
      </> : null}
    </> : <FormRaster>{customerType}{person}{contact}{address}{payment}{more}</FormRaster>}
    {defaults}
  </div>;
}

function fieldSpecId(field: CustomerField) {
  const ids: Partial<Record<CustomerField, string>> = {
    customerType:"kundentyp",autoInfo:"auto_info",vorrang:"vorrang",
    companyName: "name",
    phone: "telefon",
    street: "strasse",
    city: "ort",
    country: "land",
    salutation: "anrede",
    firstName: "vorname",
    lastName: "nachname",
    contactRole: "funktion",
    billingEmail: "rechnungs_email",
    houseNumber: "hausnummer",
    zipCode: "plz",
    paymentPreference: "zahlungsbedingung",
    handoverPreference: "uebergabe",
    vatId: "ustid",
    paymentTermDays: "zahlungsziel_tage",
  };
  return ids[field] ?? field;
}
