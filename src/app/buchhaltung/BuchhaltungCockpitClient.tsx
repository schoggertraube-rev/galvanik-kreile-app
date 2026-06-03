"use client";

import { useEffect, useState } from "react";
import {
  FileText, Camera, Fuel, TrendingUp, CreditCard,
  Receipt, FileCheck, Download, Settings, ChevronRight,
  CheckCircle2, Briefcase, CalendarClock, Sparkles, Banknote,
  Wallet, ArrowRight
} from "lucide-react";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { UstvaWerte, Ersparnis, KategorieSumme } from "@/lib/buchhaltung/types";
import { pruefeFristen } from "@/lib/buchhaltung/regeln";
import Link from "next/link";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

// ── Category Card Component ──────────────────────────────────────────────

function CategoryCard({ icon, iconBg, title, description, href, badge, stats }: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  href: string;
  badge?: { label: string; variant: "action" | "ready" | "prep" };
  stats?: { label: string; value: string }[];
}) {
  const badgeColors = {
    action: "bg-red-50 text-red-600 border-red-100",
    ready: "bg-emerald-50 text-emerald-600 border-emerald-100",
    prep: "bg-amber-50 text-amber-600 border-amber-100",
  };

  return (
    <Link
      href={href}
      className="group relative bg-white border border-neutral-gray-100 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6 sm:p-8 flex flex-col gap-4 overflow-hidden cursor-pointer min-h-[200px]"
    >
      {/* Watermark Icon */}
      <div className="absolute -right-4 -bottom-4 pointer-events-none opacity-[0.04] transform scale-[10] -rotate-12 origin-bottom-right">
        {icon}
      </div>

      {/* Top: Icon + Badge */}
      <div className="relative z-10 flex items-start justify-between">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${iconBg} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        {badge && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${badgeColors[badge.variant]}`}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Title + Description */}
      <div className="relative z-10">
        <h3 className="text-xl font-extrabold text-navy-900 leading-tight mb-1.5">{title}</h3>
        <p className="text-[13px] text-text-muted leading-relaxed">{description}</p>
      </div>

      {/* Stats Row */}
      {stats && stats.length > 0 && (
        <div className="relative z-10 flex flex-wrap gap-4 mt-auto">
          {stats.map((s, i) => (
            <div key={i}>
              <div className="text-lg font-extrabold text-navy-900 tracking-tight">{s.value}</div>
              <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Open Arrow */}
      <div className="relative z-10 flex items-center gap-1 text-xs font-bold text-accent-orange group-hover:gap-2 transition-all mt-auto">
        Öffnen <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </Link>
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
        <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
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
          <Link href="/buchhaltung/belege" className="flex items-center gap-2 px-4 py-3 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors shadow-sm active:scale-[0.98] min-h-[44px]">
            <Camera className="w-4.5 h-4.5" strokeWidth={2} />
            Beleg fotografieren
          </Link>
          <Link href="/buchhaltung/einstellungen" className="flex items-center gap-2 px-4 py-3 bg-white text-text-muted rounded-xl font-semibold text-sm border border-neutral-gray-200 hover:text-navy-900 transition-colors shadow-sm active:scale-[0.98] min-h-[44px]">
            <Settings className="w-4.5 h-4.5" strokeWidth={1.8} />
            Voreinstellungen
          </Link>
        </div>
      </div>

      {/* ── Hero-Band: UStVA + Sparzähler ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 mb-8">
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
            <Link href="/buchhaltung/steuerprofil?tab=ustva" className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors active:scale-[0.98] min-h-[44px]">
              <Sparkles className="w-4 h-4" /> Prüfen & freigeben
            </Link>
            <Link href="/buchhaltung/export?format=steuerberater" className="px-4 py-2.5 bg-white text-text-muted rounded-xl font-semibold text-sm border border-neutral-gray-200 hover:text-navy-900 transition-colors active:scale-[0.98] min-h-[44px]">
              An Steuerberater
            </Link>
          </div>
          
          <p className="text-xs text-text-muted mt-4 relative z-10">
            3 Belege brauchen noch deinen Blick. ELSTER-Direktversand wird scharfgeschaltet, sobald dein Zertifikat hinterlegt ist.
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

      {/* ── 4 Kategorie-Kacheln ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">

        {/* 01 — Belege & Ausgaben */}
        <CategoryCard
          icon={<Receipt className="w-7 h-7 text-rose-500" strokeWidth={1.8} />}
          iconBg="bg-rose-50"
          title="Belege & Ausgaben"
          description="Belege fotografieren, KI-Erkennung, Ausgaben nach Kategorie, Fix- & variable Kosten, Kraftstoff & Kfz."
          href="/buchhaltung/belege"
          badge={{ label: "3 prüfen", variant: "action" }}
          stats={[
            { label: "Belege", value: "142" },
            { label: "Ausgaben", value: `${gesamtAusgaben.toLocaleString("de-DE")} €` },
          ]}
        />

        {/* 02 — Einnahmen & Rechnungen */}
        <CategoryCard
          icon={<FileCheck className="w-7 h-7 text-emerald-600" strokeWidth={1.8} />}
          iconBg="bg-emerald-50"
          title="Einnahmen & Rechnungen"
          description="Ausgangsrechnungen, offene Posten, Mahnwesen, E-Rechnung (ZUGFeRD/XRechnung)."
          href="/buchhaltung/rechnungen"
          badge={{ label: "3 überfällig", variant: "action" }}
          stats={[
            { label: "Rechnungen", value: "42" },
            { label: "Offen", value: "12.450 €" },
          ]}
        />

        {/* 03 — Zahlungsbereich */}
        <CategoryCard
          icon={<CreditCard className="w-7 h-7 text-teal-600" strokeWidth={1.8} />}
          iconBg="bg-teal-50"
          title="Zahlungsbereich"
          description="Zahlungsdienstleister, QR-Codes, Vor-Ort-Terminal, Zahlungsmoral & Zahlungsstatistik."
          href="/buchhaltung/zahlung"
          badge={{ label: "In Vorbereitung", variant: "prep" }}
          stats={[
            { label: "Zahlungsarten", value: "5" },
            { label: "Pünktlich", value: "82 %" },
          ]}
        />

        {/* 04 — Auswertung & Export */}
        <CategoryCard
          icon={<TrendingUp className="w-7 h-7 text-blue-600" strokeWidth={1.8} />}
          iconBg="bg-blue-50"
          title="Auswertung & Export"
          description="BWA, Steuerprofil, UStVA, DATEV, Lexware, Steuerberater-Paket, Fristen & Pflichten."
          href="/buchhaltung/export"
          badge={{ label: "Bereit", variant: "ready" }}
          stats={[
            { label: "Ergebnis", value: "+19.200 €" },
            { label: "Nächste Frist", value: `${Math.max(0, 10 - new Date().getDate())}d` },
          ]}
        />
      </div>

      {/* ── Premium: Steuerberater-Paket ──────────────────────────────── */}
      <div className="bg-white border border-neutral-gray-100 rounded-2xl shadow-sm p-5 flex flex-col sm:flex-row items-center gap-5">
        <div className="w-12 h-12 rounded-xl bg-accent-orange/10 flex items-center justify-center shrink-0">
          <Briefcase className="w-6 h-6 text-accent-orange" strokeWidth={1.7} />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-base font-bold text-navy-900 mb-1">Steuerberater-Paket</h3>
          <p className="text-xs text-text-muted">Digitaler Aktenordner für die Monatsübergabe: kontierte Buchungen, Belege, Auswertungen — ein ZIP, ein Klick.</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent-orange">Premium-Modul</span>
        <Link href="/buchhaltung/export?format=steuerberater" className="text-xs font-bold text-accent-orange flex items-center gap-1 whitespace-nowrap hover:gap-2 transition-all">
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
