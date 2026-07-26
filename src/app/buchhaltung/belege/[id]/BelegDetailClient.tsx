"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import { usePageView } from "@/hooks/usePageView";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ArrowLeft, Save, ShieldCheck, XCircle, FileText, CheckCircle2, AlertTriangle, Clock, Anchor, Navigation } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

import type { BelegDetail } from "@/lib/buchhaltung/types";
import { freigebenBelegAction, stornoBelegAction } from "@/app/buchhaltung/actions";
import Image from "next/image";

interface BelegDetailClientProps {
  id: string;
  initialBeleg: BelegDetail | null;
}

export function BelegDetailClient({ id, initialBeleg }: BelegDetailClientProps) {
  usePageView();
  const beleg = initialBeleg;

  const [form, setForm] = useState(() => beleg ? {
    lieferant: beleg.lieferantText || beleg.lieferant?.name || "",
    datum: beleg.belegdatum || "",
    belegnummer: beleg.rechnungsnummerExtern || "",
    brutto: beleg.brutto?.toString() ?? "",
    netto: beleg.netto?.toString() ?? "",
    ustSatz: beleg.ustSatz?.toString() ?? "",
    ustBetrag: beleg.ustBetrag?.toString() ?? "",
    kategorie: beleg.kategorie?.name || beleg.kategorieId || "Nicht kategorisiert",
    skrKonto: beleg.skrKonto || "",
    absetzbar: beleg.absetzbarProzent?.toString() ?? "",
    notiz: beleg.absetzbarGrund || "",
  } : null);

  const [status, setStatus] = useState<string>(beleg?.status ?? "erfasst");
  const [toast, setToast] = useState<string | null>(null);
  const [stornoOpen, setStornoOpen] = useState(false);
  const [stornoGrund, setStornoGrund] = useState("");

  if (!beleg || !form) {
    return (
      <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 min-h-screen">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Buchhaltung',href:'/buchhaltung'}, {label:'Belege',href:'/buchhaltung/belege'}, {label:'Detail'}]} />
        <BackButton label="Belegliste" href="/buchhaltung/belege" />
      </div>
      
        <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
          <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/buchhaltung/belege" className="hover:text-navy-900 transition-colors">Belege</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-navy-900">Nicht gefunden</span>
        </div>
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-8 text-center mt-8">
          <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h2 className="text-lg font-extrabold text-[#1e1b18] mb-2">Beleg nicht gefunden</h2>
          <p className="text-sm text-neutral-500 mb-6">Der Beleg mit der ID &ldquo;{id}&rdquo; existiert nicht oder wurde noch nicht erfasst.</p>
          <Link href="/buchhaltung/belege" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1e1b18] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors">
            <ArrowLeft className="w-4 h-4" /> Zurück zu Belegen
          </Link>
        </div>
      </div>
    );
  }

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    const parseDecimal = (value: string): number | null => {
      const normalized = value.trim().replace(',', '.');
      if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const brutto = parseDecimal(form.brutto);
    const netto = parseDecimal(form.netto);
    const ustSatz = parseDecimal(form.ustSatz);
    const ustBetrag = parseDecimal(form.ustBetrag);
    const absetzbarProzent = parseDecimal(form.absetzbar);
    if (
      !form.lieferant.trim() || !form.datum || brutto === null || netto === null
      || ustSatz === null || ustBetrag === null || absetzbarProzent === null
    ) {
      showToast("Lieferant, Datum und gültige Beträge mit höchstens zwei Nachkommastellen sind erforderlich.");
      return;
    }
    
    const korrektur = {
      lieferantText: form.lieferant.trim(),
      belegdatum: form.datum,
      rechnungsnummerExtern: form.belegnummer,
      brutto,
      netto,
      ustSatz,
      ustBetrag,
      skrKonto: form.skrKonto,
      absetzbarProzent,
      absetzbarGrund: form.notiz,
    };
    
    try {
      const saved = await freigebenBelegAction(id, korrektur);
      setStatus(saved.status);
      showToast("Korrektur wurde in der Datenbank gespeichert.");
    } catch {
      showToast("Korrektur konnte nicht gespeichert werden. Der angezeigte Datenbankstand bleibt unverändert.");
    }
  };

  const handleFreigabe = async () => {
    try {
      const saved = await freigebenBelegAction(id);
      setStatus(saved.status);
      showToast("Der Beleg wurde in der Datenbank festgeschrieben.");
    } catch {
      showToast("Freigabe fehlgeschlagen. Der Beleg wurde nicht als festgeschrieben angezeigt.");
    }
  };

  const handleStorno = async () => {
    if (!stornoGrund.trim()) {
      showToast("Bitte Storno-Grund angeben.");
      return;
    }
    
    try {
      const saved = await stornoBelegAction(id, stornoGrund);
      setStatus(saved.status);
      setStornoOpen(false);
      showToast("Der Beleg wurde storniert und der Stornogrund protokolliert.");
    } catch {
      showToast("Storno fehlgeschlagen. Der Beleg bleibt unverändert.");
    }
  };

  const statusLabel = status === "pruefen" ? "Prüfung erforderlich" : status === "erfasst" ? "Erfasst" : status === "festgeschrieben" ? "Freigegeben" : "Storniert";
  const statusColorClass = status === "pruefen" ? "bg-amber-50 text-amber-700" : status === "erfasst" ? "bg-blue-50 text-blue-700" : status === "festgeschrieben" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 min-h-screen">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#1e1b18] text-white text-sm font-bold rounded-xl px-5 py-3 shadow-lg max-w-sm animate-in slide-in-from-top-2 fade-in">
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung/belege" className="hover:text-navy-900 transition-colors">Belege</Link>
        <ChevronRight className="w-3 h-3" />
        {beleg.lieferantId ? (
          <Link href={`/lieferanten/${beleg.lieferantId}`} className="text-navy-900 truncate max-w-[200px] hover:underline">{beleg.lieferantText || beleg.lieferant?.name || "Lieferant ohne Namen"}</Link>
        ) : (
          <span className="text-navy-900 truncate max-w-[200px]">{beleg.lieferantText || "Lieferant nicht erfasst"}</span>
        )}
      </div>

      {/* Back + Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/buchhaltung/belege" className="w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4 text-[#1e1b18]" />
          </Link>
          <div>
            {beleg.lieferantId ? (
              <Link href={`/lieferanten/${beleg.lieferantId}`} className="text-xl sm:text-2xl font-extrabold text-[#1e1b18] tracking-tight hover:underline hover:text-navy-600 transition-colors">
                {beleg.lieferantText || beleg.lieferant?.name || "Lieferant ohne Namen"}
              </Link>
            ) : (
              <span className="text-xl sm:text-2xl font-extrabold text-[#1e1b18] tracking-tight">{beleg.lieferantText || "Lieferant nicht erfasst"}</span>
            )}
            <div className="flex items-center gap-3 mt-1">
              <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wide uppercase ${statusColorClass}`}>{statusLabel}</span>
              <span className="text-xs text-neutral-500">{beleg.belegart || "Art nicht erfasst"} · {beleg.id.substring(0,8)}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl sm:text-3xl font-extrabold text-[#1e1b18]">{beleg.brutto === undefined ? "Betrag nicht erfasst" : `${beleg.brutto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`}</div>
          <div className="text-xs text-neutral-400 mt-0.5">OCR-Konfidenz: {beleg.ocrConfidence === undefined ? "nicht verfügbar" : `${beleg.ocrConfidence.toFixed(1)} %`}</div>
        </div>
      </div>

      {/* Main Grid: Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Preview (Image) */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-4 sm:p-6 flex-1 flex flex-col">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Original-Beleg</h3>
            <div className="bg-neutral-50 rounded-2xl p-4 flex flex-col items-center justify-center flex-1 border border-neutral-100 overflow-hidden relative min-h-[400px]">
              {beleg.originalDatei && beleg.originalDatei.startsWith('http') ? (
                <div className="relative w-full h-full min-h-[400px] overflow-auto cursor-crosshair">
                  <Image src={beleg.originalDatei} alt="Original Beleg" fill className="object-contain" />
                </div>
              ) : (
                <>
                  <FileText className="w-16 h-16 text-neutral-200 mb-3" />
                  <p className="text-xs text-neutral-400 font-bold">{beleg.originalFormat?.includes('pdf') ? 'PDF' : 'FOTO'} — {beleg.belegart}</p>
                  <p className="text-[10px] text-neutral-400 mt-1">Bild kann nicht aus Storage geladen werden oder fehlt.</p>
                </>
              )}
            </div>
          </div>
          
          {/* Persisted relations only */}
          <div className="bg-linear-to-br from-[#1e1b18] to-navy-900 rounded-3xl shadow-sm p-4 sm:p-6 text-white border-2 border-[#1e1b18]">
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Anchor className="w-4 h-4" /> Gespeicherte Verknüpfungen
            </h3>
            {beleg.verknuepfteKostenposten.length > 0 || beleg.zugeordneterOrderId || beleg.kraftstoffDetail ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {beleg.verknuepfteKostenposten.map((cost) => (
                  <Link key={cost.id} href={`/buchhaltung/kosten/${encodeURIComponent(cost.id)}`} className="p-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all text-center">
                    <FileText className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                    <span className="block text-xs font-bold">Kostenposten</span>
                    <span className="block truncate text-[9px] text-white/60">{cost.bezeichnung}</span>
                  </Link>
                ))}
                {beleg.zugeordneterOrderId ? (
                  <Link href={`/orders/${encodeURIComponent(beleg.zugeordneterOrderId)}`} className="p-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all text-center">
                    <FileText className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                    <span className="block text-xs font-bold">Auftrag</span>
                    <span className="block text-[9px] text-white/60">Gespeicherte Zuordnung</span>
                  </Link>
                ) : null}
                {beleg.kraftstoffDetail ? (
                  <Link href="/buchhaltung/kraftstoff" className="p-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all text-center">
                  <Navigation className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                    <span className="block text-xs font-bold">Kraftstoffdetail</span>
                    <span className="block text-[9px] text-white/60">Für diesen Beleg gespeichert</span>
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-white/70">Für diesen Beleg ist derzeit keine fachliche Verknüpfung gespeichert.</p>
            )}
          </div>
        </div>

        {/* Right: Form & Actions */}
        <div className="flex flex-col gap-6">
          {/* OCR Form */}
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-4 sm:p-6">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Erkannte / Bearbeitbare Felder</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Lieferant" value={form.lieferant} onChange={v => setForm({ ...form, lieferant: v })} />
              <FormField label="Datum" value={form.datum} onChange={v => setForm({ ...form, datum: v })} type="date" />
              <FormField label="Belegnummer" value={form.belegnummer} onChange={v => setForm({ ...form, belegnummer: v })} />
              <FormField label="Brutto (€)" value={form.brutto} onChange={v => setForm({ ...form, brutto: v })} />
              <FormField label="Netto (€)" value={form.netto} onChange={v => setForm({ ...form, netto: v })} />
              <FormField label="USt-Satz (%)" value={form.ustSatz} onChange={v => setForm({ ...form, ustSatz: v })} />
              <FormField label="USt-Betrag (€)" value={form.ustBetrag} onChange={v => setForm({ ...form, ustBetrag: v })} />
              <FormField label="Kategorie (nur Anzeige)" value={form.kategorie} onChange={() => undefined} readOnly />
              <FormField label="SKR-Konto" value={form.skrKonto} onChange={v => setForm({ ...form, skrKonto: v })} />
              <FormField label="Absetzbarkeit (%)" value={form.absetzbar} onChange={v => setForm({ ...form, absetzbar: v })} />
              <div className="sm:col-span-2">
                <FormField label="Notiz" value={form.notiz} onChange={v => setForm({ ...form, notiz: v })} multiline />
              </div>
            </div>

            <p className="text-[10px] text-neutral-400 mt-4">Nur vom Server bestätigte Änderungen werden als gespeichert angezeigt.</p>
          </div>

          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-4 sm:p-6">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
              OCR-Positionen · unbestätigte Vorschläge
            </h3>
            <p className="text-[10px] text-neutral-400 mb-4">
              Diese Werte stammen aus der Texterkennung. Sie sind keine bestätigten Buchungspositionen und ihre Netto-/Steuerbasis ist nicht festgelegt.
            </p>
            {beleg.ocrPositionenState === "not_run" ? (
              <p className="text-xs text-neutral-500">Für diesen Beleg wurden keine OCR-Positionen gespeichert.</p>
            ) : beleg.ocrPositionenState === "empty" ? (
              <p className="text-xs text-neutral-500">OCR wurde ausgeführt; es wurden keine Positionen erkannt.</p>
            ) : (
              <div className="space-y-2">
                {beleg.ocrPositionen.map((position, index) => (
                  <div key={`${position.beschreibung}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-bold text-amber-950">{position.beschreibung}</span>
                      <span className="text-xs font-extrabold text-amber-950">
                        {position.betrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-amber-800">
                      {position.menge === null ? "Menge nicht erkannt" : `Menge ${position.menge.toLocaleString("de-DE")}`}
                      {" · "}
                      {position.einzelpreis === null
                        ? "Einzelpreis nicht erkannt"
                        : `Einzelpreis ${position.einzelpreis.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        {/* Right: KI + Audit + Actions */}

          {/* KI Hinweise */}
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-4 sm:p-6">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">KI-/Regelhinweise</h3>
            <div className="space-y-3">
              {beleg.kiPruefstatus === "not_run" ? (
                <p className="text-xs text-neutral-500">Automatische KI-/Regelprüfung wurde für diesen Beleg nicht ausgeführt.</p>
              ) : beleg.kiHinweise.length > 0 ? beleg.kiHinweise.map((h, i) => (
                <div key={i} className={`rounded-xl p-3 text-xs ${h.typ === "plausibilitaet" ? "bg-amber-50 border border-amber-200" : h.typ === "absetzbarkeit" ? "bg-emerald-50 border border-emerald-200" : "bg-blue-50 border border-blue-200"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {h.typ === "plausibilitaet" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : h.typ === "absetzbarkeit" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
                    <span className={`font-extrabold ${h.typ === "plausibilitaet" ? "text-amber-800" : h.typ === "absetzbarkeit" ? "text-emerald-800" : "text-blue-800"}`}>{h.regel}</span>
                  </div>
                  <p className={`${h.typ === "plausibilitaet" ? "text-amber-700" : h.typ === "absetzbarkeit" ? "text-emerald-700" : "text-blue-700"}`}>{h.text}</p>
                  {h.paragraf && <p className="text-[10px] text-neutral-400 mt-1">{h.paragraf}</p>}
                </div>
              )) : (
                <p className="text-xs text-neutral-400">Prüfung ausgeführt; keine Hinweise gespeichert.</p>
              )}
            </div>
          </div>

          {/* Audit */}
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-4 sm:p-6">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Gespeicherter Nachweisstatus</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Clock className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[#1e1b18]">Erfasst</p>
                  <p className="text-[10px] text-neutral-400">{new Date(beleg.erfasstAm).toLocaleString("de-DE")} · {beleg.erstelltVon}</p>
                </div>
              </div>
              {status === "festgeschrieben" && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-700">Freigegeben</p>
                    <p className="text-[10px] text-neutral-400">Gespeicherter Belegstatus. Die vollständige Audit-Historie wird in dieser Ansicht noch nicht geladen.</p>
                  </div>
                </div>
              )}
              {status === "storniert" && (
                <div className="flex items-start gap-3">
                  <XCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-rose-700">Storniert</p>
                    <p className="text-[10px] text-neutral-400">Gespeicherter Belegstatus. Der Stornogrund liegt im serverseitigen Auditnachweis.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-4 sm:p-6">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Aktionen</h3>
            <div className="space-y-3">
              <button
                onClick={handleSave}
                disabled={status === "festgeschrieben" || status === "storniert"}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e1b18] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" /> Korrektur speichern
              </button>
              <button
                onClick={handleFreigabe}
                disabled={status !== "erfasst"}
                title={status === "pruefen" ? "Korrektur zuerst speichern und prüfen" : undefined}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShieldCheck className="w-4 h-4" /> Freigeben
              </button>
              <button
                onClick={() => setStornoOpen(true)}
                disabled={status === "storniert"}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-rose-600 border border-rose-200 rounded-xl font-bold text-sm hover:bg-rose-50 transition-colors min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4" /> Storno vorbereiten
              </button>
              <Link
                href="/buchhaltung/belege"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-neutral-600 border border-neutral-200 rounded-xl font-bold text-sm hover:bg-neutral-50 transition-colors min-h-[48px]"
              >
                <ArrowLeft className="w-4 h-4" /> Zurück zu Belegen
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Storno Dialog */}
      {stornoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setStornoOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 z-10 mx-4">
            <h3 className="text-lg font-extrabold text-[#1e1b18] mb-4">Storno vorbereiten</h3>
            <p className="text-xs text-neutral-500 mb-4">Der Beleg wird nicht gelöscht, sondern durch eine Gegenbuchung storniert. Im GoBD-Modus wird dies revisionssicher dokumentiert.</p>
            <label className="block text-xs font-bold text-neutral-600 mb-2">Storno-Grund (Pflichtfeld)</label>
            <textarea
              value={stornoGrund}
              onChange={e => setStornoGrund(e.target.value)}
              className="w-full border border-neutral-200 rounded-xl p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
              placeholder="Grund für die Stornierung eingeben…"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStornoOpen(false)} className="flex-1 px-4 py-3 text-sm font-bold text-neutral-500 hover:bg-neutral-50 rounded-xl transition-colors min-h-[48px]">
                Abbrechen
              </button>
              <button onClick={handleStorno} className="flex-1 px-4 py-3 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors min-h-[48px]">
                Storno bestätigen
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackFooter pageTitle="Belegdetail" route={`/buchhaltung/belege/${id}`} variant="full" />
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", multiline = false, readOnly = false }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
  readOnly?: boolean;
}) {
  const cls = "w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-[#1e1b18] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 min-h-[44px]";
  return (
    <div>
      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} className={cls} rows={2} readOnly={readOnly} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className={cls} readOnly={readOnly} />
      )}
    </div>
  );
}
