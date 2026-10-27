"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import type { OrderCardActionPorts, OrderCardState } from "../server/types";
import {
  Button,
  Chip,
  Dialog,
  Auswahl,
  Eingabe,
  Fakten,
  Feld,
  Hinweis,
  Karte,
  KartenBlock,
  Kartenkopf,
  NaechsteAktion,
  Notiz,
  Schnellaktionen,
  Seitenblatt,
  Segment,
  Teil,
  TerminBox,
  Textfeld,
  Verlauf,
  ZahlungsSchwelle,
  Zustand,
  Zustandskette,
  type Geraet,
  type IconName,
  type SchnellAktion,
  type SchrittStatus,
} from "@/ui/kr";

const STATIONS = ["angenommen", "galvanik", "fertig", "zahlung", "abgeholt"] as const;
const SURFACE_OPTIONS = ["Verchromen", "Vernickeln", "Verzinken", "Entchromen / prüfen", "noch zu klären"] as const;

function money(cents: number | null) {
  return cents === null ? "Nicht belegt" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function dueLabel(value: string | null) {
  if (!value) return "Kein Termin belegt";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "Termin nicht lesbar";
}

function dueStatus(value: string | null) {
  if (!value) return { relative: "Kein Termin belegt", overdue: false };
  const target = new Date(`${value.slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (!Number.isFinite(target.getTime())) return { relative: "Termin nicht lesbar", overdue: false };
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { relative: `${Math.abs(days)} ${Math.abs(days) === 1 ? "Tag" : "Tage"} überfällig`, overdue: true };
  if (days === 0) return { relative: "Heute fällig", overdue: false };
  if (days === 1) return { relative: "Morgen fällig", overdue: false };
  return { relative: `In ${days} Tagen`, overdue: false };
}

function readDevice(): Geraet {
  if (window.innerWidth <= 699) return "handy";
  if (window.innerWidth <= 1399 && window.matchMedia?.("(pointer: coarse)").matches) return "tablet";
  return "desktop";
}

function subscribeDevice(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function formatMoment(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "Zeitpunkt nicht lesbar";
}

function stateText(state: Exclude<OrderCardState, { kind: "data" }>) {
  if (state.kind === "loading") return "Auftragskarte wird geladen.";
  if (state.kind === "not-found") return "Auftrag nicht vorhanden.";
  if (state.kind === "denied") return "Auftragskarte nicht freigegeben.";
  if (state.kind === "conflict") return "Auftragsstand nicht eindeutig.";
  return "Auftragskarte nicht verfügbar.";
}

function actionStatus(index: number, current: number): SchrittStatus {
  if (index < current) return "erledigt";
  if (index === current) return "aktiv";
  if (index === current + 1) return "bereit";
  return "warten";
}

function paymentModeLabel(mode: "vorkasse" | "abholung" | "rechnung"): string {
  if (mode === "vorkasse") return "Vorkasse";
  if (mode === "abholung") return "Abholung";
  return "Rechnung";
}

export function OrderCardView({
  state,
  actions,
  attachmentPanel,
  documentsPanel,
  onOpenCustomer,
  onClose,
}: {
  state: OrderCardState;
  actions: OrderCardActionPorts;
  attachmentPanel?: ReactNode;
  documentsPanel?: ReactNode;
  onOpenCustomer: (id: string) => void;
  onClose: () => void;
}) {
  const device = useSyncExternalStore(subscribeDevice, readDevice, () => "desktop" as const);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"" | "bar" | "ueberweisung" | "karte">("");
  const [dueOpen, setDueOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState<string | "new" | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [notice, setNotice] = useState("");

  if (state.kind !== "data") {
    const loading = state.kind === "loading";
    const message = loading ? stateText(state) : `${stateText(state)} ${state.message}`;
    return (
      <Seitenblatt
        titel="Auftragskarte"
        onSchliessen={onClose}
        zustand={loading ? "laedt" : state.kind === "denied" ? "gesperrt" : "fehler"}
        texte={{ laedtText: message, gesperrtText: message, fehlerText: message }}
      >
        {null}
      </Seitenblatt>
    );
  }

  const card = state.card;
  const payment = card.payment.kind === "available" ? card.payment.value : null;
  const current = card.station === "abgeholt" ? 4 : payment?.status === "bezahlt" ? 3 : Math.max(0, STATIONS.indexOf(card.station as (typeof STATIONS)[number]));
  const deadline = dueStatus(card.dueAt);
  const paymentFree = payment?.status === "bezahlt" || payment?.mode === "rechnung";
  const contentEnabled = Boolean(actions.content?.enabled && actions.onSaveContent);
  const contentItems = card.items.map((item) => ({
    id: item.id,
    catalogServiceId: item.catalogServiceId ?? null,
    name: item.name,
    quantity: item.quantity,
    material: item.material,
    surface: item.surface,
    unit: item.unit ?? null,
    unitPriceCents: item.unitPriceCents ?? null,
    vatRateBasisPoints: item.vatRateBasisPoints ?? null,
  }));
  const unavailable = (reason: string | null | undefined) => setNotice(reason ?? "Diese Aktion ist derzeit nicht verfügbar.");

  const invokeStation = (station: (typeof STATIONS)[number]) => {
    if (station === "galvanik" && actions.handoff.enabled) void actions.onHandoff();
    if (station === "fertig" && actions.freeze.enabled) void actions.onFreeze();
    if (station === "zahlung" && actions.invoice.enabled) void actions.onIssueInvoice();
    else if (station === "zahlung" && actions.payment.enabled) setPaymentOpen(true);
    if (station === "abgeholt" && actions.goodsOut.enabled) void actions.onRecordGoodsOut("abholung");
  };

  const next = actions.handoff.visible
    ? { title: "Übergabe an die Galvanik", text: "In Galvanik", icon: "droplet" as IconName, onClick: () => void actions.onHandoff() }
    : actions.freeze.visible
      ? { title: "Fertig melden, sobald alle Teile durch sind", text: "Fertig melden", icon: "checkc" as IconName, onClick: () => void actions.onFreeze() }
      : actions.invoice.visible
        ? { title: "Rechnung unveränderlich ausstellen", text: "Rechnung", icon: "receipt" as IconName, onClick: () => void actions.onIssueInvoice() }
        : actions.payment.visible
          ? { title: "Zahlungseingang bestätigen", text: "Zahlung", icon: "card" as IconName, onClick: () => setPaymentOpen(true) }
          : actions.goodsOut.visible
            ? { title: actions.goodsOut.enabled ? "Warenausgang prüfen" : "Warenausgang wartet auf Freigabe", text: "Ware raus", icon: "truck" as IconName, onClick: () => void actions.onRecordGoodsOut("abholung") }
            : null;

  const quickActions: SchnellAktion[] = [];
  if (actions.handoff.visible && actions.handoff.enabled) quickActions.push({ key: "handoff", text: "Galvanik", icon: "droplet", primaer: true, onClick: () => void actions.onHandoff() });
  if (actions.freeze.visible && actions.freeze.enabled) quickActions.push({ key: "freeze", text: "Fertig", icon: "checkc", erledigen: true, onClick: () => void actions.onFreeze() });
  if (actions.invoice.visible && actions.invoice.enabled) quickActions.push({ key: "invoice", text: "Rechnung", icon: "receipt", onClick: () => void actions.onIssueInvoice() });
  if (actions.payment.visible && actions.payment.enabled) quickActions.push({ key: "payment", text: "Zahlung", icon: "card", onClick: () => setPaymentOpen(true) });
  if (actions.goodsOut.visible && actions.goodsOut.enabled) quickActions.push({ key: "goods", text: "Ware raus", icon: "truck", primaer: true, onClick: () => void actions.onRecordGoodsOut("abholung") });
  quickActions.push(
    { key: "status-mail", text: "Status-Mail", icon: "mail", onClick: () => actions.onOpenStatusMail ? actions.onOpenStatusMail() : unavailable("Status-Mail ist derzeit nicht verfügbar.") },
    { key: "call", text: "Anrufen", icon: "phone", onClick: () => actions.contact?.enabled && actions.onCallCustomer ? actions.onCallCustomer() : unavailable(actions.contact?.reason) },
    { key: "photo", text: "Foto +", icon: "camera", onClick: () => actions.photo?.enabled && actions.onOpenPhoto ? actions.onOpenPhoto() : unavailable(actions.photo?.reason) },
    { key: "more", text: "Mehr", icon: "more", onClick: () => setMoreOpen(true) },
  );

  const history = [
    ...card.dueDateChanges?.map((change) => ({ key: change.eventId, zeit: formatMoment(change.changedAt), text: `Liefertermin geändert · ${dueLabel(change.changedTo)} · ${change.reason} · ${change.changedBy}`, icon: "calendar" as IconName, ton: "warn" as const })) ?? [],
    ...card.evidence.map((entry) => ({ key: entry.key, zeit: formatMoment(entry.recordedAt), text: `${entry.source} · ${entry.state}`, icon: "file" as IconName })),
    ...(card.frozenAt ? [{ key: "freeze", zeit: formatMoment(card.frozenAt), text: "Auftrag fertig gemeldet", icon: "checkc" as IconName, ton: "ok" as const }] : []),
    { key: "intake", zeit: formatMoment(card.intakeAt), text: `Angenommen · ${card.items.length} ${card.items.length === 1 ? "Position" : "Positionen"}`, icon: "box" as IconName },
  ];

  const head = (
    <Kartenkopf
      nummer={card.orderNumber}
      titel={card.title}
      sub={`${card.items.length} ${card.items.length === 1 ? "Position" : "Positionen"} · ${card.status}`}
      meta={<><Chip text={card.station} ton={deadline.overdue ? "rot" : "info"} /><Button art="leise" icon="user" text={`${card.customerName} · Kundenakte`} onClick={() => onOpenCustomer(card.customerId)} /></>}
      termin={<><TerminBox relativ={deadline.relative} datum={dueLabel(card.dueAt)} status={<Chip text={deadline.overdue ? "überfällig" : "bestätigt"} ton={deadline.overdue ? "rot" : "ok"} />} dringend={deadline.overdue} />{actions.dueDate?.visible ? <Button art="leise" icon="calendar" text="Termin ändern" disabled={!actions.dueDate.enabled} onClick={() => setDueOpen(true)} /> : null}</>}
      onSchliessen={onClose}
    />
  );

  const chain = <>
    <Zustandskette schritte={[
      { key: "angenommen", label: "angenommen", icon: "check", status: actionStatus(0, current), sub: new Date(card.intakeAt).toLocaleDateString("de-DE") },
      { key: "galvanik", label: "Galvanik", icon: "droplet", status: actionStatus(1, current), onClick: actions.handoff.visible && actions.handoff.enabled ? () => invokeStation("galvanik") : undefined },
      { key: "fertig", label: "fertig", icon: "flag", status: actionStatus(2, current), onClick: actions.freeze.visible && actions.freeze.enabled ? () => invokeStation("fertig") : undefined },
      { key: "zahlung", label: "Zahlung", icon: "card", status: paymentFree ? "erledigt" : actions.payment.enabled ? "bereit" : "gesperrt", schwelle: true, frei: paymentFree, onClick: actions.payment.visible && actions.payment.enabled ? () => setPaymentOpen(true) : undefined },
      { key: "abgeholt", label: payment?.goodsOut?.mode === "versand" ? "verschickt" : "abgeholt", icon: "truck", status: card.station === "abgeholt" ? "erledigt" : actions.goodsOut.enabled ? "bereit" : "gesperrt", onClick: actions.goodsOut.visible && actions.goodsOut.enabled ? () => invokeStation("abgeholt") : undefined },
    ]} />
    {!paymentFree && payment ? <ZahlungsSchwelle text={`${paymentModeLabel(payment.mode)} · ${payment.invoiceState === "issued" ? payment.status ?? "offen" : "Rechnung noch nicht ausgestellt"}`} aktion={actions.payment.visible && actions.payment.enabled ? <Button art="primaer" icon="card" text="Zahlung prüfen" onClick={() => setPaymentOpen(true)} /> : undefined} /> : null}
  </>;

  const main = <>
    {next ? <KartenBlock><NaechsteAktion titel={next.title} aktionen={<Button art={actions.freeze.visible ? "erledigen" : "primaer"} icon={next.icon} text={next.text} disabled={(actions.handoff.visible && !actions.handoff.enabled) || (actions.freeze.visible && !actions.freeze.enabled) || (actions.invoice.visible && !actions.invoice.enabled) || (actions.payment.visible && !actions.payment.enabled) || (actions.goodsOut.visible && !actions.goodsOut.enabled)} onClick={next.onClick} />} /></KartenBlock> : null}
    <KartenBlock label="Teile" rechts={<Button art="leise" icon="plus" text="Teil hinzufügen" disabled={!contentEnabled || card.items.length >= 20} onClick={() => contentEnabled ? setItemOpen("new") : unavailable(actions.content?.reason)} />}>
      <div className="kr-teile">{card.items.map((item) => <Teil key={item.id} nr={`Pos. ${item.position}`} name={item.name} meta={`${item.surface} · ${item.quantity} Stück · ${item.material ?? "Material nicht hinterlegt"}${item.extraWork.length ? ` · ${item.extraWork.length} Mehrarbeit` : ""}`} fertig={Boolean(item.finished) || current >= 2} fotoFehlt={!card.evidence.some((entry) => entry.itemIds.includes(item.id))} geraet={device} onFoto={() => actions.photo?.enabled && actions.onOpenPhoto ? actions.onOpenPhoto() : unavailable(actions.photo?.reason)} aktionen={<><Button art={item.finished ? "erledigen" : "sekundaer"} icon="check" text={device === "handy" ? undefined : "fertig"} label={`Teil ${item.finished ? "wieder öffnen" : "fertig melden"}`} disabled={!actions.onToggleItemFinished || !actions.itemStatus?.enabled || current >= 2} onClick={() => void actions.onToggleItemFinished?.(item.id, !item.finished)} /><Button art="sekundaer" icon="edit" label="Teil bearbeiten" disabled={!contentEnabled} onClick={() => contentEnabled ? setItemOpen(item.id) : unavailable(actions.content?.reason)} /></>} />)}</div>
      {card.items.length === 0 ? <Zustand art="leer" text="Für diesen Auftrag sind noch keine Positionen erfasst." /> : null}
      {actions.evidence.visible && attachmentPanel ? <div className="kr-stapel">{attachmentPanel}</div> : null}
    </KartenBlock>
    <KartenBlock label="Notizen" rechts={<Button art="leise" icon={card.note ? "edit" : "plus"} text="Notiz" disabled={!contentEnabled} onClick={() => contentEnabled ? setNoteOpen(true) : unavailable(actions.content?.reason)} />}><Notiz text={card.note ?? "Keine Auftragsnotiz hinterlegt."} bezug={<Chip text="Auftrag" ton="info" />} autor={card.assignedTo ?? "Nicht zugewiesen"} /></KartenBlock>
    <KartenBlock label="Fotos & Dokumente">
      {card.evidence.length ? <div className="kr-docs">{card.evidence.map((entry) => <span className="kr-doc" key={entry.key}>{entry.source} · {entry.state}</span>)}</div> : <Zustand art="leer" text="Noch keine Dokumente oder Fotos vorhanden." />}
      {documentsPanel}
    </KartenBlock>
    {card.payment.kind === "available" ? <KartenBlock label="Rechnung"><Fakten zeilen={[{ k: "Zahlungsmodus", v: payment ? paymentModeLabel(payment.mode) : "Nicht belegt" }, { k: "Rechnung", v: payment?.invoiceState === "issued" ? payment.status ?? "offen" : "noch nicht ausgestellt" }, { k: "Offen", v: money(payment?.openAmountCents ?? null), warn: Boolean(payment?.openAmountCents) }]} /></KartenBlock> : <KartenBlock label="Rechnung"><Zustand art={card.payment.kind === "restricted" ? "gesperrt" : "fehler"} text={card.payment.message} /></KartenBlock>}
    {actions.freeze.visible && !actions.freeze.enabled && actions.freeze.reason?.includes("Stundensatz") ? <Hinweis ton="warn">{actions.freeze.reason} <a href={`/settings?returnTo=${encodeURIComponent(`/orders/${card.id}`)}#extra-work-rate`}>Stundensatz jetzt einrichten</a>.</Hinweis> : null}
    {actions.feedback.kind !== "idle" ? actions.feedback.kind === "submitting" ? <Zustand art="laedt" text={actions.feedback.message} /> : <Hinweis ton={actions.feedback.kind === "success" ? "ok" : "warn"}>{actions.feedback.message}{actions.feedback.kind === "conflict" ? <Button art="sekundaer" icon="refresh" text="Neu laden" onClick={() => void actions.onReload()} /> : null}</Hinweis> : null}
    {notice ? <Hinweis ton="warn">{notice}</Hinweis> : null}
  </>;

  const rail = <>{device === "desktop" && quickActions.length ? <KartenBlock><Schnellaktionen aktionen={quickActions} als="raster" /></KartenBlock> : null}<KartenBlock label="Verlauf"><Verlauf eintraege={history} /></KartenBlock></>;
  const footer = device === "desktop" ? <footer className="kr-kartenfuss"><Button text="Schließen" onClick={onClose} />{next ? <Button art="primaer" icon={next.icon} text={next.text} disabled={(actions.handoff.visible && !actions.handoff.enabled) || (actions.freeze.visible && !actions.freeze.enabled) || (actions.invoice.visible && !actions.invoice.enabled) || (actions.payment.visible && !actions.payment.enabled) || (actions.goodsOut.visible && !actions.goodsOut.enabled)} onClick={next.onClick} /> : null}</footer> : quickActions.length ? <Schnellaktionen aktionen={quickActions} als="dock" /> : undefined;

  return <>
    <Seitenblatt titel={`Auftragskarte ${card.orderNumber}`} onSchliessen={onClose}>
      <Karte kopf={head} kette={chain} haupt={main} rail={rail} fuss={footer} />
    </Seitenblatt>
    {paymentOpen ? <Dialog titel="Zahlung bestätigen" icon="card" groesse="schmal" onSchliessen={() => setPaymentOpen(false)} fuss={<><Button text="Abbrechen" onClick={() => setPaymentOpen(false)} /><Button art="primaer" icon="check" text="Zahlung bestätigen" disabled={!paymentMethod} onClick={() => { if (!paymentMethod) return; void actions.onConfirmPayment(paymentMethod); setPaymentOpen(false); }} /></>}><Segment label="Zahlart" wert={paymentMethod} onWert={setPaymentMethod} optionen={[{ wert: "bar", text: "Bar" }, { wert: "ueberweisung", text: "Überweisung" }, { wert: "karte", text: "Karte" }]} /></Dialog> : null}
    {dueOpen ? <Dialog titel="Liefertermin ändern" icon="calendar" groesse="schmal" onSchliessen={() => setDueOpen(false)}><form className="kr-stapel" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void actions.onChangeDueDate?.(String(form.get("dueDate") ?? ""), String(form.get("reason") ?? "")); setDueOpen(false); }}><Feld label="Neuer Liefertermin"><Eingabe type="date" name="dueDate" defaultValue={card.dueAt?.slice(0, 10) ?? ""} required /></Feld><Feld label="Grund der Änderung"><Textfeld name="reason" minLength={3} maxLength={500} required /></Feld><Button art="primaer" icon="calendar" text="Termin mit Grund speichern" type="submit" /></form></Dialog> : null}
    {noteOpen ? <Dialog titel="Auftragsnotiz bearbeiten" icon="edit" groesse="schmal" onSchliessen={() => setNoteOpen(false)}><form className="kr-stapel" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const value = String(form.get("note") ?? "").trim(); void actions.onSaveContent?.({ note: value || null, items: contentItems }); setNoteOpen(false); }}><Feld label="Notiz"><Textfeld name="note" defaultValue={card.note ?? ""} maxLength={2000} /></Feld><Button art="primaer" icon="check" text="Notiz speichern" type="submit" /></form></Dialog> : null}
    {itemOpen ? <OrderItemDialog card={card} itemId={itemOpen} onClose={() => setItemOpen(null)} onSave={(items) => { void actions.onSaveContent?.({ note: card.note, items }); setItemOpen(null); }} /> : null}
    {moreOpen ? <Dialog titel="Mehr zum Auftrag" icon="more" groesse="schmal" onSchliessen={() => setMoreOpen(false)}><div className="kr-stapel"><Button art="sekundaer" icon="file" text="KV anlegen" onClick={() => { actions.onOpenQuote?.(); setMoreOpen(false); }} /><Button art="sekundaer" icon="copy" text="Duplizieren" onClick={() => { void actions.onDuplicate?.(); setMoreOpen(false); }} /><Button art="sekundaer" icon="upload" text="Dokument hinzufügen" onClick={() => { actions.onOpenDocument?.(); setMoreOpen(false); }} /></div></Dialog> : null}
  </>;
}

function OrderItemDialog({ card, itemId, onClose, onSave }: { card: Extract<OrderCardState, { kind: "data" }>["card"]; itemId: string | "new"; onClose: () => void; onSave: (items: NonNullable<Parameters<NonNullable<OrderCardActionPorts["onSaveContent"]>>[0]>["items"]) => void }) {
  const existing = itemId === "new" ? null : card.items.find((item) => item.id === itemId) ?? null;
  const [serviceId, setServiceId] = useState(existing?.catalogServiceId ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [surface, setSurface] = useState(existing?.surface ?? "");
  const service = card.catalog?.find((entry) => entry.id === serviceId);
  const surfaces = [...new Set([...SURFACE_OPTIONS, ...(existing?.surface ? [existing.surface] : []), ...(card.catalog ?? []).map((entry) => entry.surface)])];
  const selectName = (value: string) => {
    const matches = (card.catalog ?? []).filter((entry) => entry.name.localeCompare(value.trim(), "de-DE", { sensitivity: "base" }) === 0);
    const selected = matches.length === 1 ? matches[0] : null;
    setName(value);
    setServiceId(selected?.id ?? "");
    if (selected) setSurface(selected.surface);
  };
  return <Dialog titel={existing ? "Teil bearbeiten" : "Teil hinzufügen"} icon={existing ? "edit" : "plus"} groesse="schmal" onSchliessen={onClose}><form className="kr-stapel" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const base = service ? { catalogServiceId: service.id, name: service.name, surface: service.surface, unit: service.unit, unitPriceCents: service.netPriceCents, vatRateBasisPoints: service.vatRateBasisPoints } : { catalogServiceId: null, name: String(form.get("name") ?? ""), surface: String(form.get("surface") ?? ""), unit: null, unitPriceCents: null, vatRateBasisPoints: null };
    const changed = { id: existing?.id ?? crypto.randomUUID(), ...base, quantity: Number(form.get("quantity")), material: String(form.get("material") ?? "").trim() || null };
    const current = card.items.map((item) => ({ id: item.id, catalogServiceId: item.catalogServiceId ?? null, name: item.name, quantity: item.quantity, material: item.material, surface: item.surface, unit: item.unit ?? null, unitPriceCents: item.unitPriceCents ?? null, vatRateBasisPoints: item.vatRateBasisPoints ?? null }));
    onSave(existing ? current.map((item) => item.id === existing.id ? changed : item) : [...current, changed]);
  }}><datalist id="kr-order-item-catalog">{(card.catalog ?? []).map((entry) => <option key={entry.id} value={entry.name}>{entry.surface}</option>)}</datalist><Feld label="Teil / Bezeichnung"><Eingabe name="name" list="kr-order-item-catalog" placeholder="Katalog oder Freitext" value={name} onChange={(event) => selectName(event.target.value)} required minLength={2} maxLength={160} /></Feld><Feld label="Oberfläche"><Auswahl name="surface" value={surface} onChange={(event) => { setSurface(event.target.value); if (service?.surface !== event.target.value) setServiceId(""); }} optionen={[{ wert: "", text: "Bitte wählen" }, ...surfaces.map((entry) => ({ wert: entry, text: entry }))]} required /></Feld><Feld label="Menge"><Eingabe name="quantity" type="number" min={1} max={1_000_000} defaultValue={existing?.quantity ?? 1} required /></Feld><Feld label="Material"><Eingabe name="material" defaultValue={existing?.material ?? ""} maxLength={120} /></Feld><Button art="primaer" icon="check" text={existing ? "Teil speichern" : "Teil hinzufügen"} type="submit" /></form></Dialog>;
}
