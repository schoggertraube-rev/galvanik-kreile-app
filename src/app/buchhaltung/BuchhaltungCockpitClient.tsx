"use client";

import { useEffect, useState } from "react";
import {
  FileText, Camera, Fuel, Clock, TrendingUp, CreditCard,
  QrCode, Smartphone, BarChart3, PieChart, Receipt, FileCheck,
  Download, AlertCircle, Settings, ChevronRight, CheckCircle2,
  Briefcase, CalendarClock, Sparkles, Banknote
} from "lucide-react";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { UstvaWerte, Ersparnis, KategorieSumme } from "@/lib/buchhaltung/types";
import { pruefeFristen } from "@/lib/buchhaltung/regeln";
import Link from "next/link";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

// ── Types ────────────────────────────────────────────────────────────────

type TileProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  href?: string;
  kpi?: string;
  status?: { label: string; variant: "action" | "ready" | "prep" | "default" };
  footer?: string;
};

// ── Tile Component ───────────────────────────────────────────────────────

function Tile({ title, description, icon, iconColor, href, kpi, status, footer }: TileProps) {
  const statusColors = {
    action: "bg-red-50 text-red-600 border-red-100",
    ready: "bg-emerald-50 text-emerald-600 border-emerald-100",
    prep: "bg-amber-50 text-amber-600 border-amber-100",
    default: "bg-neutral-gray-100 text-text-muted border-neutral-gray-200",
  };

  const inner = (
    <>
      {/* Watermark */}
      <div className="absolute -right-2 -bottom-2 pointer-events-none opacity-10 transform scale-[7] -rotate-12 origin-bottom-right">
        {icon}
      </div>

      <div className="relative z-10 flex items-start justify-end gap-3 min-h-[24px]">
        {kpi && (
          <span className="text-xl font-extrabold text-navy-900 tracking-tight">{kpi}</span>
        )}
        {status && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColors[status.variant]}`}>
            {status.label}
          </span>
        )}
      </div>
      <h3 className="relative z-10 text-lg font-extrabold text-navy-900 leading-snug">{title}</h3>
      <p className="relative z-10 text-[13px] text-text-muted leading-relaxed">{description}</p>
      <div className="relative z-10 flex items-center justify-between mt-auto pt-1">
        <span className="text-xs font-bold text-accent-orange flex items-center gap-1 group-hover:gap-2 transition-all">
          {footer ?? "Öffnen"} <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </>
  );

  const className = "group relative overflow-hidden bg-white border border-neutral-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-5 flex flex-col gap-3 min-h-[140px] cursor-pointer";

  if (href) {
    return <Link href={href} className={className}>{inner}</Link>;
  }
  return <div className={className}>{inner}</div>;
}

// ── Section Header ───────────────────────────────────────────────────────

function SectionHeader({ number, title, badge }: { number: string; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-4 px-1">
      <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">{number}</span>
      <span className="text-base font-extrabold text-navy-900">{title}</span>
      {badge && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Main Cockpit ─────────────────────────────────────────────────────────

export function BuchhaltungCockpitClient() {
  const [ustva, setUstva] = useState<UstvaWerte | null>(null);
  const [ersparnis, setErsparnis] = useState<Ersparnis | null>(null);
  const [kategorien, setKategorien] = useState<KategorieSumme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const now = new Date();
      const monatsAnfang = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const monatsEnde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
      const zeitraum = { von: monatsAnfang, bis: monatsEnde };

      const [u, e, k] = await Promise.all([
        provider.berechneUstva(zeitraum),
        provider.getErsparnis(now.getFullYear()),
        provider.getAusgabenNachKategorie(zeitraum),
      ]);
      setUstva(u);
      setErsparnis(e);
      setKategorien(k);
      setLoading(false);
    };
    load();
  }, []);

  const fristen = pruefeFristen();
  const gesamtAusgaben = kategorien.reduce((sum, k) => sum + k.summe, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Buchhaltung & Finanzen</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent-orange/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-accent-orange" strokeWidth={1.8} />
            </div>
            <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Buchhaltung & Finanzen</h1>
          </div>
          <p className="text-sm text-text-muted mt-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Automatik aktiv
            </span>
            <span>· {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</span>
            <span>· SKR03</span>
            <span>· revisionssicher (GoBD)</span>
            {ersparnis && <span>· {ersparnis.anzahlAutoBelege} Belege · {ersparnis.prozentAutomatisch} % automatisch</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-3 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors shadow-sm active:scale-[0.98]">
            <Camera className="w-4.5 h-4.5" strokeWidth={2} />
            Beleg fotografieren
          </button>
          <button className="flex items-center gap-2 px-4 py-3 bg-white text-text-muted rounded-xl font-semibold text-sm border border-neutral-gray-200 hover:text-navy-900 transition-colors shadow-sm active:scale-[0.98]">
            <Settings className="w-4.5 h-4.5" strokeWidth={1.8} />
            Voreinstellungen
          </button>
        </div>
      </div>

      {/* ── Hero-Band: UStVA + Sparzähler ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 mb-6">
        {/* UStVA Hero */}
        <div className="relative bg-white border border-neutral-gray-100 rounded-2xl shadow-sm p-6 overflow-hidden">
          <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-linear-to-br from-emerald-50 to-transparent pointer-events-none" />
          
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-2.5 h-2.5 text-white" strokeWidth={3} />
            </span>
            Fertig vorbereitet & geprüft
          </div>
          
          <h2 className="text-lg font-extrabold text-navy-900 mb-1 relative z-10">
            Umsatzsteuer-Voranmeldung · {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
          </h2>
          <p className="text-sm text-text-muted mb-5">KI-kontiert · Werte berechnet · bereit zur Freigabe</p>
          
          <div className="flex flex-wrap gap-7 mb-5 relative z-10">
            <div>
              <div className="text-2xl font-extrabold text-navy-900 tracking-tight">
                {ustva ? ustva.zahllast.toLocaleString("de-DE") : "—"} <span className="text-base">€</span>
              </div>
              <div className="text-xs text-text-muted mt-1">Zahllast ans Finanzamt</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-navy-900 tracking-tight">
                {ersparnis?.anzahlAutoBelege ?? "—"}
              </div>
              <div className="text-xs text-text-muted mt-1">Belege · {ersparnis?.prozentAutomatisch ?? 0} % automatisch</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-amber-600 tracking-tight">
                {fristen.length > 0 ? "10. " + new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString("de-DE", { month: "long" }) : "—"}
              </div>
              <div className="text-xs text-text-muted mt-1">Frist · in {Math.max(0, 10 - new Date().getDate())} Tagen</div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 relative z-10">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors active:scale-[0.98]">
              <Sparkles className="w-4 h-4" /> Prüfen & freigeben
            </button>
            <button className="px-4 py-2.5 bg-white text-text-muted rounded-xl font-semibold text-sm border border-neutral-gray-200 hover:text-navy-900 transition-colors active:scale-[0.98]">
              An Steuerberater
            </button>
          </div>
          
          <p className="text-xs text-text-muted mt-4 relative z-10">
            3 Belege brauchen noch deinen Blick. ELSTER-Direktversand wird scharfgeschaltet, sobald dein Zertifikat hinterlegt ist — bis dahin: Export für den ELSTER-Upload.
          </p>
        </div>

        {/* Sparzähler */}
        <div className="bg-linear-to-br from-emerald-500 to-emerald-700 text-white rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/8 pointer-events-none" />
          <div className="text-xs font-bold uppercase tracking-widest opacity-85 mb-2">Gespart {new Date().getFullYear()}</div>
          <div className="text-4xl font-extrabold tracking-tight">
            {ersparnis ? ersparnis.betrag.toLocaleString("de-DE") : "—"} <span className="text-lg">€</span>
          </div>
          <p className="text-sm opacity-90 mt-3 leading-relaxed relative z-10">
            weil <strong>{ersparnis?.prozentAutomatisch ?? 0} %</strong> automatisch vorbereitet wird und dein Steuerberater nur noch <strong>freigibt</strong> statt zu sortieren.
          </p>
        </div>
      </div>

      {/* ── Abschnitt 01: Belege & Ausgaben ──────────────────────────── */}
      <SectionHeader number="01" title="Belege & Ausgaben" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          title="Belege erfassen & prüfen"
          description="Foto rein, Inhalt automatisch erkannt & kategorisiert. 3 von 142 unsicher."
          icon={<Receipt className="w-5 h-5 text-accent-orange" strokeWidth={1.8} />}
          iconColor="bg-accent-orange/10"
          href="/buchhaltung/belege"
          status={{ label: "3 prüfen", variant: "action" }}
        />
        <Tile
          title="Kraftstoff & Kfz"
          description="Diesel auf einen Blick: 18 Tankungen, Ø 1,71 €/l. Filterbar nach Ort & Zeit."
          icon={<Fuel className="w-5 h-5 text-blue-600" strokeWidth={1.8} />}
          iconColor="bg-blue-50"
          href="/buchhaltung/kraftstoff"
          kpi="1.240 €"
          footer="Auswertung"
        />
        <Tile
          title="Ausgaben gesamt"
          description="Laufender Monat nach Kategorie. KI-Hinweise zur Absetzbarkeit inklusive."
          icon={<Clock className="w-5 h-5 text-amber-600" strokeWidth={1.8} />}
          iconColor="bg-amber-50"
          href="/buchhaltung/ausgaben"
          kpi={`${gesamtAusgaben.toLocaleString("de-DE")} €`}
          footer="Details"
        />
      </div>

      {/* ── Abschnitt 02: Einnahmen, Rechnungen & Zahlung ────────────── */}
      <SectionHeader number="02" title="Einnahmen, Rechnungen & Zahlung" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          title="Offene Posten"
          description="3 Zahlungen überfällig. Mahnstufen & Zahlungserinnerung automatisch."
          icon={<AlertCircle className="w-5 h-5 text-red-500" strokeWidth={1.8} />}
          iconColor="bg-red-50"
          href="/buchhaltung/rechnungen"
          kpi="12.450 €"
          status={{ label: "3 überfällig", variant: "action" }}
          footer="Details"
        />
        <Tile
          title="Rechnungsübersicht & Statistik"
          description="Ausgangsrechnungen laufender Monat. Schreiben, E-Rechnung (ZUGFeRD)."
          icon={<FileCheck className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
          iconColor="bg-emerald-50"
          href="/buchhaltung/rechnungen"
          kpi="42"
          footer="Details"
        />
        <Tile
          title="Zahlungsdienstleister"
          description="Anbieter für Checkout & Kartenzahlung. Optionen & Konditionen prüfen."
          icon={<CreditCard className="w-5 h-5 text-teal-600" strokeWidth={1.8} />}
          iconColor="bg-teal-50"
          status={{ label: "In Vorbereitung", variant: "prep" }}
          footer="Optionen prüfen"
        />
        <Tile
          title="Zahlungslink & QR-Code"
          description="Rechnung direkt per Link oder QR zahlen lassen. Ablauf anzeigen."
          icon={<QrCode className="w-5 h-5 text-teal-600" strokeWidth={1.8} />}
          iconColor="bg-teal-50"
          status={{ label: "In Vorbereitung", variant: "prep" }}
          footer="Ablauf anzeigen"
        />
        <Tile
          title="Vor-Ort-Zahlung"
          description="Terminal oder Tap-to-Pay bei Abholung. Szenario prüfen."
          icon={<Smartphone className="w-5 h-5 text-teal-600" strokeWidth={1.8} />}
          iconColor="bg-teal-50"
          status={{ label: "In Vorbereitung", variant: "prep" }}
          footer="Szenario prüfen"
        />
        <Tile
          title="Zahlungsmoral & Zahlungsarten"
          description="Wer zahlt pünktlich, welche Arten dominieren. Auswertung öffnen."
          icon={<BarChart3 className="w-5 h-5 text-neutral-gray-500" strokeWidth={1.8} />}
          iconColor="bg-neutral-gray-100"
          status={{ label: "In Vorbereitung", variant: "prep" }}
          footer="Auswertung"
        />
      </div>

      {/* ── Abschnitt 03: Auswertung & Steuerprofil ──────────────────── */}
      <SectionHeader number="03" title="Auswertung & Steuerprofil" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          title="BWA / Monatsübersicht"
          description="Betriebswirtschaftliche Auswertung. Einnahmen, Ausgaben, Ergebnis."
          icon={<TrendingUp className="w-5 h-5 text-teal-600" strokeWidth={1.8} />}
          iconColor="bg-teal-50"
          href="/buchhaltung/bwa"
          kpi="+19.200 €"
          footer="Details"
        />
        <Tile
          title="Fixkosten"
          description="Feste monatliche Ausgaben: Miete, Strom-Grund, Abos, Versicherungen."
          icon={<PieChart className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
          iconColor="bg-emerald-50"
          href="/buchhaltung/kosten"
          kpi="fix"
          footer="Details"
        />
        <Tile
          title="Variable Kosten"
          description="Dynamische Kosten: Material, Kraftstoff, Fremdleistung — nach Auslastung."
          icon={<TrendingUp className="w-5 h-5 text-amber-600" strokeWidth={1.8} />}
          iconColor="bg-amber-50"
          href="/buchhaltung/kosten"
          kpi="variabel"
          footer="Details"
        />
        <Tile
          title="Steuerprofil"
          description="USt-Sätze 19 % / 7 % / 0 %, Kleinunternehmer-Status, Voranmeldungs-Rhythmus."
          icon={<Banknote className="w-5 h-5 text-neutral-gray-500" strokeWidth={1.8} />}
          iconColor="bg-neutral-gray-100"
          href="/buchhaltung/steuerprofil"
          kpi="DE"
          footer="Details"
        />
      </div>

      {/* ── Abschnitt 04: Export & Steuerberater ─────────────────────── */}
      <SectionHeader number="04" title="Export & Steuerberater" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          title="DATEV-Export"
          description="Buchungsstapel (EXTF, SKR03) + Belegbilder. Vorschau & ein-Klick-Übergabe."
          icon={<Download className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
          iconColor="bg-emerald-50"
          href="/buchhaltung/export"
          status={{ label: "Bereit", variant: "ready" }}
          footer="Vorschau öffnen"
        />
        <Tile
          title="Lexware / Excel"
          description="Einfacher CSV-Export für Lexware oder Tabellenkalkulation."
          icon={<FileCheck className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
          iconColor="bg-emerald-50"
          href="/buchhaltung/export"
          status={{ label: "Bereit", variant: "ready" }}
          footer="Vorschau öffnen"
        />
        <Tile
          title="Fristen & Pflichten"
          description="UStVA, GewSt, Rundfunkbeitrag. Rechtzeitige Erinnerung, nie verpassen."
          icon={<CalendarClock className="w-5 h-5 text-accent-orange" strokeWidth={1.8} />}
          iconColor="bg-accent-orange/10"
          href="/buchhaltung/fristen"
          status={{ label: "Überwacht", variant: "ready" }}
          footer="Kalender"
        />
      </div>

      {/* ── Premium: Steuerberater-Paket ──────────────────────────────── */}
      <div className="bg-white border border-neutral-gray-100 rounded-2xl shadow-sm p-5 flex flex-col sm:flex-row items-center gap-5 mt-6">
        <div className="w-12 h-12 rounded-xl bg-accent-orange/10 flex items-center justify-center shrink-0">
          <Briefcase className="w-6 h-6 text-accent-orange" strokeWidth={1.7} />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-base font-bold text-navy-900 mb-1">Steuerberater-Paket</h3>
          <p className="text-xs text-text-muted">Digitaler Aktenordner für die Monatsübergabe: kontierte Buchungen, Belege, Auswertungen — ein ZIP, ein Klick.</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent-orange">Premium-Modul</span>
        <Link href="/buchhaltung/export" className="text-xs font-bold text-accent-orange flex items-center gap-1 whitespace-nowrap hover:gap-2 transition-all">
          Paket-Inhalte prüfen <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── Footer-Note ──────────────────────────────────────────────── */}
      <p className="text-xs text-text-muted text-center mt-8 leading-relaxed max-w-2xl mx-auto">
        <strong>Stufe 1 (Livegang):</strong> erfassen, kategorisieren, auswerten, exportieren — alles funktioniert.{" "}
        <strong>Stufe 2:</strong> ELSTER-Direktversand, Live-Bank & Lohn-Meldung docken an, sobald Zertifikat & Zugänge da sind.
        <br />
        Einmal Regeln einstellen — danach läuft die Buchhaltung im Hintergrund.
      </p>

      <FeedbackFooter pageTitle="Buchhaltung" route="/buchhaltung" variant="full" />
    </div>
  );
}
