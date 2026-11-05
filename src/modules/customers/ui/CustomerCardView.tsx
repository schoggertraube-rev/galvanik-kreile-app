"use client";

import { type ReactNode, useState, useSyncExternalStore } from "react";
import type { CustomerCardState, UpdateCustomerInput } from "../server/types";
import { kundeVollstaendigkeit } from "../orderReadiness";
import { customerCountryLabel } from "../customerFormContract";
import {customerPaymentLabel} from "../paymentPreferenceContract";
import { CustomerEditor } from "./CustomerEditor";
import type { CustomerAddressInput, CustomerAddressResult } from "../customerAddress";
import {
  Auftragszeile,
  Button,
  Chip,
  Fakten,
  Hinweis,
  Karte,
  KartenBlock,
  Kartenkopf,
  NaechsteAktion,
  Notiz,
  Schnellaktionen,
  Seitenblatt,
  Zustand,
  Verlauf,
  Toast,
  type Geraet,
  type SchnellAktion,
} from "@/ui/kr";

function due(value: string | null) {
  if (!value) return "Kein Termin";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "Termin nicht lesbar";
}

function moment(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })
    : "Zeitpunkt nicht lesbar";
}

function euro(cents: number) {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function readDevice(): Geraet {
  if (window.innerWidth <= 699) return "handy";
  if (window.innerWidth <= 1399 && window.matchMedia?.("(pointer: coarse)").matches) return "tablet";
  return "desktop";
}

function subscribeDevice(onChange: () => void) {
  const coarse = window.matchMedia?.("(pointer: coarse)");
  window.addEventListener("resize", onChange);
  coarse?.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    coarse?.removeEventListener("change", onChange);
  };
}

const readServerDevice = (): Geraet => "desktop";

function customerType(type: string) {
  if (type === "business" || type === "Geschäftskunde") return "Gewerbekunde";
  if (type === "private" || type === "privat" || type === "Privatkunde") return "Privatkunde";
  return type || "Kundentyp nicht hinterlegt";
}

function isClosedStation(station: string) {
  return ["abgeholt", "versendet", "raus"].includes(station);
}

function stateKind(state: Exclude<CustomerCardState, { kind: "data" }>) {
  if (state.kind === "loading") return "laedt" as const;
  if (state.kind === "denied") return "gesperrt" as const;
  return "fehler" as const;
}

export function CustomerCardView({
  state,
  onOpenOrder,
  onClose,
  onSaveCustomer,
  onNewOrder,
  documentsPanel,
  canManageMoney=false,
  canDecide=false,
  initialEdit=false,
  missingFirst=false,
  checkAddress,
  takeover,
}: {
  state: CustomerCardState;
  onOpenOrder: (id: string) => void;
  onClose: () => void;
  onSaveCustomer?: (input: UpdateCustomerInput) => Promise<{ ok: true } | { ok: false; message: string }>;
  onNewOrder?: () => void;
  documentsPanel?: ReactNode;
  takeover?:unknown;
  canManageMoney?:boolean;canDecide?:boolean;initialEdit?:boolean;missingFirst?:boolean;
  checkAddress?:(input:CustomerAddressInput)=>Promise<{code:"OK";data:CustomerAddressResult}|{code:string;message:string}>;
}) {
  const device = useSyncExternalStore(subscribeDevice, readDevice, readServerDevice);
  const [editOpen, setEditOpen] = useState(initialEdit);
  const [saveMessage, setSaveMessage] = useState("");

  if (state.kind !== "data") {
    const text = state.kind === "loading" ? "Kundenkarte wird geladen." : state.message;
    const art = stateKind(state);
    return <Seitenblatt
      dataSpecId="kunde"
      titel="Kundenkarte"
      onSchliessen={onClose}
      zustand={art}
      texte={art === "laedt" ? { laedtText: text } : art === "gesperrt" ? { gesperrtText: text } : { fehlerText: text }}
    >{null}</Seitenblatt>;
  }

  const card = state.card;
  const readiness=kundeVollstaendigkeit({customerType:card.type==="privat"||card.type==="lieferant"?card.type:"business",companyName:card.companyName,firstName:card.firstName,lastName:card.lastName,phone:card.phone,email:card.email,street:card.address,houseNumber:card.houseNumber,zipCode:card.zipCode,city:card.city,country:card.country,paymentPreference:card.paymentPreference,invoiceTermsEnabled:card.invoiceTermsEnabled},{geld:canManageMoney});
  const missingForOrder=readiness.fehlt;
  const active = card.orders.filter((order) => !isClosedStation(order.station));
  const history = card.orders.filter((order) => isClosedStation(order.station));
  const next = active.slice().sort((a, b) => {
    const at = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  })[0];

  const openPhone = () => { if (card.phone) window.location.assign(`tel:${card.phone}`); };
  const openMail = () => { if (card.email) window.location.assign(`mailto:${card.email}`); };
  const quickActions: SchnellAktion[] = [
    ...(onNewOrder ? [{ key: "order", text: "Neuer Auftrag", icon: "plus" as const, primaer: true, onClick: onNewOrder }] : []),
    ...(card.phone ? [{ key: "phone", text: "Anrufen", icon: "phone" as const, onClick: openPhone }] : []),
    ...(card.email ? [{ key: "mail", text: "E-Mail", icon: "mail" as const, onClick: openMail }] : []),
    ...(onSaveCustomer ? [{ key: "edit", text: "Bearbeiten", icon: "edit" as const, onClick: () => setEditOpen(true) }] : []),
  ];

  const head = <Kartenkopf
    nummer={card.customerNumber ?? "Ohne Kundennummer"}
    titel={card.companyName ?? card.name}
    sub={`${customerType(card.type)} · Kunde seit ${new Date(card.createdAt).toLocaleDateString("de-DE")}`}
    meta={<>
      {card.city ? <Chip text={card.city} icon="box" /> : null}
      {card.contactPerson ? <Chip text={card.contactPerson} icon="user" ton="info" /> : null}
      {card.phone ? <Button art="leise" icon="phone" text={card.phone} onClick={openPhone} /> : null}
      {card.email ? <Button art="leise" icon="mail" text={card.email} onClick={openMail} /> : null}
      {canManageMoney && card.paymentPreference==="rechnung" ? <Chip text="Rechnung auf Ziel" ton="ok" icon="receipt" /> : null}
    </>}
    onSchliessen={onClose}
  />;

  const main = <>
    {missingForOrder.length ? <KartenBlock><Hinweis ton="warn">{readiness.text}</Hinweis></KartenBlock> : null}
    {next ? <KartenBlock><NaechsteAktion
      titel={`${next.orderNumber} · ${next.title} · Termin ${due(next.dueAt)}`}
      aktionen={<Button art="primaer" icon="open" text="Auftragskarte öffnen" onClick={() => onOpenOrder(next.id)} />}
    /></KartenBlock> : null}
    <KartenBlock
      label="Aktive Aufträge"
      rechts={onNewOrder ? <Button art="leise" icon="plus" text="Neuer Auftrag" onClick={onNewOrder} /> : undefined}
    >
      {active.length ? <div className="kr-stapel" style={{ gap: 8 }}>{active.map((order) => <Auftragszeile
        key={order.id}
        id={order.orderNumber}
        kundeKurz=""
        titel={order.title}
        meta={`${order.station} · Termin ${due(order.dueAt)}`}
        ton="info"
        status={{ text: order.status, ton: isClosedStation(order.station) ? "ok" : "info" }}
        karte
        onOeffnen={() => onOpenOrder(order.id)}
      />)}</div> : <Zustand art="leer" text="Keine aktiven Aufträge." aktion={onNewOrder ? { text: "Neuer Auftrag", icon: "plus", onClick: onNewOrder } : undefined} />}
    </KartenBlock>
    <KartenBlock label="Notizen & Telefonnotizen">
      {card.notes ? <Notiz text={card.notes} bezug={<Chip text="Kundennotiz" ton="teil" icon="phone" />} autor={`aktualisiert ${moment(card.updatedAt)}`} /> : <Zustand art="leer" text="Keine interne Kundennotiz hinterlegt." />}
      {card.tags.length ? <div className="kr-docs" style={{ marginTop: 8 }}>{card.tags.map((tag) => <Chip key={tag} text={tag} />)}</div> : null}
    </KartenBlock>
    <KartenBlock label="Stammdaten" rechts={onSaveCustomer ? <Button data-spec-id="kunde.bearbeiten" art="leise" icon="edit" text="Bearbeiten" onClick={() => setEditOpen(true)} /> : undefined}>
      <Fakten zeilen={[
        { k: "Ansprechpartner", v: card.contactPerson ?? "Nicht hinterlegt" },
        { k: "Telefon", v: card.phone ?? "Nicht hinterlegt" },
        { k: "E-Mail", v: card.email ?? "Nicht hinterlegt" },
        { k: "Anschrift", v: [[card.address,card.houseNumber].filter(Boolean).join(" "), [card.zipCode, card.city].filter(Boolean).join(" "), customerCountryLabel(card.country)].filter(Boolean).join(", ") || "Nicht hinterlegt" },
        ...(canManageMoney?[{ k: "Zahlungsbedingung", v: customerPaymentLabel(card.paymentPreference,{invoiceTermDays:card.invoiceTermDays}) }]:[]),
        { k: "USt-ID", v: card.vatId ?? "Nicht hinterlegt" },
      ]} />
    </KartenBlock>
    <KartenBlock label="Fotos & Dokumente">{documentsPanel ?? <Zustand art="leer" text="Noch keine Dokumente vorhanden." />}</KartenBlock>
    {history.length ? <KartenBlock label="Abgeschlossene Aufträge"><div className="kr-stapel" style={{ gap: 8 }}>{history.map((order) => <Auftragszeile
      key={order.id}
      id={order.orderNumber}
      kundeKurz=""
      titel={order.title}
      meta={`${order.station} · ${due(order.dueAt)}`}
      ton="ok"
      status={{ text: order.status, ton: "ok" }}
      onOeffnen={() => onOpenOrder(order.id)}
    />)}</div></KartenBlock> : null}
  </>;

  const rail = <>
    {device === "desktop" && quickActions.length ? <KartenBlock><Schnellaktionen aktionen={quickActions} als="raster" /></KartenBlock> : null}
    <KartenBlock label="Kundenstand"><Fakten zeilen={[
      { k: "Aufträge gesamt", v: card.orderCount },
      { k: "Ware im Haus", v: card.wareImHausCount },
      ...(canManageMoney?[{ k: "Umsatz aus Rechnungen", v: euro(card.invoiceRevenueCents) },{ k: "Offene Posten", v: euro(card.invoiceOpenCents) }]:[]),
      { k: "Klassifikation", v: card.classification ?? "Nicht hinterlegt" },
    ]} /></KartenBlock>
    <KartenBlock label="Kontaktverlauf"><Verlauf eintraege={[
      { key: "updated", zeit: moment(card.updatedAt), text: "Kundenstand aktualisiert", icon: "edit", ton: "ok" },
      { key: "created", zeit: moment(card.createdAt), text: "Kunde angelegt", icon: "user" },
    ]} /></KartenBlock>
  </>;
  const footer = device === "desktop"
    ? <footer className="kr-kartenfuss"><Button data-spec-id="kunde.schliessen" text="Schließen" onClick={onClose} /></footer>
    : quickActions.length ? <Schnellaktionen aktionen={quickActions} als="dock" /> : undefined;

  return <>
    <Seitenblatt dataSpecId="kunde" titel={`Kundenkarte ${card.customerNumber ?? card.name}`} onSchliessen={onClose}>
      <Karte kopf={head} haupt={main} rail={rail} fuss={footer} />
    </Seitenblatt>
    {editOpen && onSaveCustomer ? <CustomerEditor takeover={takeover} card={card} canManageMoney={canManageMoney} canDecide={canDecide} missingFirst={missingFirst} checkAddress={checkAddress} onSave={onSaveCustomer} onClose={()=>setEditOpen(false)} onSaved={message=>{setEditOpen(false);setSaveMessage(message)}}/>:null}
    {saveMessage?<Toast text={saveMessage}/>:null}
  </>;
}
