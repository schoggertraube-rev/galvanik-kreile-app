"use client";

import { type ReactNode, useState, useSyncExternalStore } from "react";
import type {
  CustomerAgreementCommandResult,
  CustomerAgreementRecord,
  CustomerAgreementSummary,
  CustomerCardState,
  RevokeCustomerAgreementInput,
  SaveCustomerAgreementInput,
  UpdateCustomerInput,
} from "../server/types";
import { kundeVollstaendigkeit } from "../orderReadiness";
import { customerCountryLabel } from "../customerFormContract";
import {customerPaymentLabel} from "../paymentPreferenceContract";
import { CustomerEditor } from "./CustomerEditor";
import { CustomerAgreementDialog } from "./CustomerAgreementDialog";
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

function berlinDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function day(value: string) {
  const [year, month, date] = value.split("-");
  return year && month && date ? `${date}.${month}.${year}` : "Datum fehlt";
}

function isTypedAgreement(agreement: CustomerAgreementSummary): agreement is CustomerAgreementRecord {
  return agreement.type !== null && typeof agreement.reason === "string";
}

function isCurrentAgreement(agreement: CustomerAgreementSummary, today: string) {
  return agreement.revokedAt === null && (agreement.validUntil === null || agreement.validUntil >= today);
}

type AgreementDialogState = {
  mode: "new" | "edit" | "revoke";
  agreement?: CustomerAgreementRecord;
  initialReason?: string;
};

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
  complaintsPanel,
  canManageMoney=false,
  canDecide=false,
  initialEdit=false,
  missingFirst=false,
  checkAddress,
  takeover,
  onSaveAgreement,
  onRevokeAgreement,
  onReload,
}: {
  state: CustomerCardState;
  onOpenOrder: (id: string) => void;
  onClose: () => void;
  onSaveCustomer?: (input: UpdateCustomerInput) => Promise<{ ok: true } | { ok: false; message: string }>;
  onNewOrder?: () => void;
  documentsPanel?: ReactNode;
  complaintsPanel?: ReactNode;
  takeover?:unknown;
  canManageMoney?:boolean;canDecide?:boolean;initialEdit?:boolean;missingFirst?:boolean;
  checkAddress?:(input:CustomerAddressInput)=>Promise<{code:"OK";data:CustomerAddressResult}|{code:string;message:string}>;
  onSaveAgreement?: (input: SaveCustomerAgreementInput) => Promise<CustomerAgreementCommandResult>;
  onRevokeAgreement?: (input: RevokeCustomerAgreementInput) => Promise<CustomerAgreementCommandResult>;
  onReload?: () => Promise<void>;
}) {
  const device = useSyncExternalStore(subscribeDevice, readDevice, readServerDevice);
  const [editOpen, setEditOpen] = useState(initialEdit);
  const [saveMessage, setSaveMessage] = useState("");
  const [agreementDialog, setAgreementDialog] = useState<AgreementDialogState | null>(null);

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
  const today = berlinDay();
  const customerAgreements = (card.agreements ?? []).filter((agreement) => agreement.orderId === null);
  const typedCustomerAgreements = customerAgreements.filter(isTypedAgreement);
  const activeAgreement = typedCustomerAgreements.find((agreement) => isCurrentAgreement(agreement, today)) ?? null;
  const earlierAgreements = typedCustomerAgreements.filter((agreement) => !isCurrentAgreement(agreement, today));
  const untypedMoneyAgreement = customerAgreements.find((agreement) => agreement.type === null && agreement.money && isCurrentAgreement(agreement, today)) ?? null;
  const agreementNotices = customerAgreements.filter((agreement) => agreement.type === null && agreement.notice && agreement.revokedAt === null);
  const canManageAgreement = canManageMoney && Boolean(onSaveAgreement && onRevokeAgreement);
  const next = active.slice().sort((a, b) => {
    const at = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  })[0];

  const openPhone = () => { if (card.phone) window.location.assign(`tel:${card.phone}`); };
  const openMail = () => { if (card.email) window.location.assign(`mailto:${card.email}`); };
  const quickActions: SchnellAktion[] = [
    ...(onNewOrder ? [{ key: "order", dataSpecId: "kunde.neuer-auftrag", text: "Neuer Auftrag", icon: "plus" as const, primaer: true, onClick: onNewOrder }] : []),
    ...(onSaveCustomer ? [{ key: "edit", dataSpecId: "kunde.bearbeiten", text: "Bearbeiten", icon: "edit" as const, onClick: () => setEditOpen(true) }] : []),
    ...(card.phone ? [{ key: "phone", text: "Anrufen", icon: "phone" as const, onClick: openPhone }] : []),
    ...(card.email ? [{ key: "mail", text: "E-Mail", icon: "mail" as const, onClick: openMail }] : []),
  ];
  const agreementAction: SchnellAktion | null = canManageAgreement
    ? {
      key: "agreement",
      dataSpecId: "kunde.absprache",
      text: "Zahlungsabsprache festlegen",
      icon: "receipt",
      onClick: () => setAgreementDialog({ mode: activeAgreement ? "edit" : "new", agreement: activeAgreement ?? undefined }),
    }
    : null;

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
    {complaintsPanel}
    {missingForOrder.length ? <KartenBlock><Hinweis ton="warn">{readiness.text}</Hinweis></KartenBlock> : null}
    {next ? <KartenBlock><NaechsteAktion
      titel={`${next.orderNumber} · ${next.title} · Termin ${due(next.dueAt)}`}
      aktionen={<Button art="primaer" icon="open" text="Auftragskarte öffnen" onClick={() => onOpenOrder(next.id)} />}
    /></KartenBlock> : null}
    <KartenBlock label="Aktive Aufträge">
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
      />)}</div> : <Zustand art="leer" text="Keine aktiven Aufträge." />}
    </KartenBlock>
    <KartenBlock label="Notizen & Telefonnotizen">
      {card.notes ? <Notiz text={card.notes} bezug={<Chip text="Kundennotiz" ton="teil" icon="phone" />} autor={`aktualisiert ${moment(card.updatedAt)}`} /> : <Zustand art="leer" text="Keine interne Kundennotiz hinterlegt." />}
      {card.tags.length ? <div className="kr-docs" style={{ marginTop: 8 }}>{card.tags.map((tag) => <Chip key={tag} text={tag} />)}</div> : null}
    </KartenBlock>
    {agreementNotices.length ? <KartenBlock label="Absprachen & Eigenheiten">
      <div className="kr-stapel">
        {agreementNotices.map((agreement) => <div key={agreement.id} data-spec-id="kunde.absprache-hinweis"><Hinweis ton="warn">{agreement.label}: {agreement.value ?? "fehlt"}</Hinweis></div>)}
      </div>
    </KartenBlock> : null}
    {canManageMoney ? <KartenBlock label="Zahlungsabsprache">
      {activeAgreement ? <div data-spec-id="kunde.absprache-zeile" className="kr-stapel">
        <strong>Zahlungsabsprache · {activeAgreement.label} · gilt für ganzer Kunde {card.companyName ?? card.name} · bis {activeAgreement.validUntil ? day(activeAgreement.validUntil) : "auf Widerruf"}</strong>
        <span>Grund {activeAgreement.reason} · angelegt {moment(activeAgreement.createdAt)} von {activeAgreement.createdBy ?? "Login fehlt"}</span>
        {canManageAgreement ? <div className="kr-schnellleiste">
          <Button data-spec-id="kunde.absprache-aendern" art="sekundaer" icon="edit" text="Absprache ändern" onClick={() => setAgreementDialog({ mode: "edit", agreement: activeAgreement })} />
          <Button data-spec-id="kunde.absprache-widerrufen" art="leise" icon="x" text="Absprache widerrufen" onClick={() => setAgreementDialog({ mode: "revoke", agreement: activeAgreement })} />
        </div> : null}
      </div> : untypedMoneyAgreement ? <div className="kr-stapel">
        <strong>Absprache {untypedMoneyAgreement.label} · Typ festlegen</strong>
        {canManageAgreement ? <Button data-spec-id="kunde.absprache-typ-festlegen" art="sekundaer" icon="edit" text="Typ festlegen" onClick={() => setAgreementDialog({ mode: "new", initialReason: untypedMoneyAgreement.reason ?? untypedMoneyAgreement.label })} /> : null}
      </div> : <Zustand art="leer" text="Keine Zahlungsabsprache festgelegt." />}
      {earlierAgreements.length ? <details data-spec-id="kunde.absprache-frueher">
        <summary>Frühere Absprachen · {earlierAgreements.length}</summary>
        <div className="kr-stapel">
          {earlierAgreements.map((agreement) => <p key={agreement.id}>
            {agreement.label} · {agreement.revokedAt ? `widerrufen ${moment(agreement.revokedAt)} von ${agreement.revokedBy ?? "Login fehlt"}` : `abgelaufen am ${agreement.validUntil ? day(agreement.validUntil) : "Datum fehlt"}`} · Grund {agreement.revokeReason ?? agreement.reason ?? "fehlt"}
          </p>)}
        </div>
      </details> : null}
    </KartenBlock> : null}
    <KartenBlock label="Stammdaten">
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
    ? <footer className="kr-kartenfuss">{agreementAction ? <Button data-spec-id="kunde.absprache" art="primaer" icon="receipt" text="Zahlungsabsprache festlegen" onClick={agreementAction.onClick} /> : null}<Button data-spec-id="kunde.schliessen" text="Schließen" onClick={onClose} /></footer>
    : agreementAction || quickActions.length ? <Schnellaktionen aktionen={agreementAction ? [agreementAction, ...quickActions] : quickActions} als="dock" /> : undefined;

  return <>
    <Seitenblatt dataSpecId="kunde" titel={`Kundenkarte ${card.customerNumber ?? card.name}`} onSchliessen={onClose}>
      <Karte kopf={head} haupt={main} rail={rail} fuss={footer} />
    </Seitenblatt>
    {editOpen && onSaveCustomer ? <CustomerEditor takeover={takeover} card={card} canManageMoney={canManageMoney} canDecide={canDecide} missingFirst={missingFirst} checkAddress={checkAddress} onSave={onSaveCustomer} onClose={()=>setEditOpen(false)} onSaved={message=>{setEditOpen(false);setSaveMessage(message)}}/>:null}
    {agreementDialog && onSaveAgreement && onRevokeAgreement ? <CustomerAgreementDialog
      target={{customerId:card.id,customerNumber:card.customerNumber,customerName:card.companyName ?? card.name}}
      mode={agreementDialog.mode}
      agreement={agreementDialog.agreement}
      initialReason={agreementDialog.initialReason}
      onSave={onSaveAgreement}
      onRevoke={onRevokeAgreement}
      onReload={onReload}
      onClose={() => setAgreementDialog(null)}
      onMessage={setSaveMessage}
    /> : null}
    {saveMessage?<Toast text={saveMessage}/>:null}
  </>;
}
