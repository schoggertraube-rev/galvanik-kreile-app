"use client";
import { usePageView } from "@/hooks/usePageView";
import { useState } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import { ChevronRight, Download, FileText, Briefcase, CheckCircle2, ArrowLeft, FolderArchive, Table, FileSpreadsheet, TrendingUp, CalendarClock, Banknote, Info } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

// ── Mock Preview Data ────────────────────────────────────────────────────

const DATEV_PREVIEW = {
  header: "Buchungsstapel;EXTF;512;21;Buchungsstapel;2;20260601;20260630;Galvanik Kreile;SKR03;0;EUR;",
  rows: [
    { umsatz: "87,50", sh: "S", konto: "4530", gkonto: "1200", datum: "01.05.2026", beleg: "bel-001", text: "ARAL Tankstelle Düsseldorf", ust: "9" },
    { umsatz: "1.250,00", sh: "S", konto: "4900", gkonto: "1200", datum: "03.05.2026", beleg: "bel-002", text: "Chemie-Shop24 GmbH", ust: "9" },
    { umsatz: "145,80", sh: "S", konto: "4650", gkonto: "1200", datum: "14.05.2026", beleg: "bel-003", text: "Restaurant Rheinblick - Bewirtung", ust: "9" },
    { umsatz: "78,40", sh: "S", konto: "4530", gkonto: "1200", datum: "02.06.2026", beleg: "bel-004", text: "Shell Frankfurt-Ost Diesel", ust: "9" },
    { umsatz: "64,00", sh: "S", konto: "4650", gkonto: "1200", datum: "31.05.2026", beleg: "bel-005", text: "Gasthaus Adler - Bewirtung", ust: "9" },
    { umsatz: "1.190,00", sh: "S", konto: "3400", gkonto: "1200", datum: "30.05.2026", beleg: "bel-006", text: "Riedel Chemie GmbH - Material", ust: "9" },
    { umsatz: "12,60", sh: "S", konto: "4930", gkonto: "1200", datum: "28.05.2026", beleg: "bel-007", text: "Microsoft 365 Abo", ust: "9" },
  ],
};

const LEXWARE_PREVIEW = {
  header: "Datum;Lieferant/Kunde;Konto;Kategorie;Betrag;USt-Satz;USt-Betrag;Belegnummer;Status",
  rows: [
    "01.05.2026;ARAL Tankstelle;4530;Kraftstoff;87,50;19%;13,97;bel-001;festgeschrieben",
    "03.05.2026;Chemie-Shop24;4900;Material;1.250,00;19%;199,58;bel-002;festgeschrieben",
    "14.05.2026;Restaurant Rheinblick;4650;Bewirtung;145,80;19%;23,28;bel-003;prüfen",
    "02.06.2026;Shell Frankfurt-Ost;4530;Kraftstoff;78,40;19%;12,52;bel-004;erfasst",
    "31.05.2026;Gasthaus Adler;4650;Bewirtung;64,00;19%;10,22;bel-005;prüfen",
    "30.05.2026;Riedel Chemie;3400;Material;1.190,00;19%;190,00;bel-006;erfasst",
    "28.05.2026;Microsoft 365;4930;Büro;12,60;19%;2,01;bel-007;erfasst",
  ],
};

const STEUERBERATER_ZIP = {
  dateiname: "steuerberaterpaket_2026-05.zip",
  dateien: [
    { name: "EXTF_Buchungsstapel_2026-05.csv", groesse: "4,2 KB", typ: "DATEV" },
    { name: "Lexware_Export_2026-05.csv", groesse: "2,8 KB", typ: "CSV" },
    { name: "BWA_2026-05.pdf", groesse: "45 KB", typ: "PDF" },
    { name: "UStVA_2026-05.pdf", groesse: "28 KB", typ: "PDF" },
    { name: "index.csv", groesse: "1,1 KB", typ: "Index" },
    { name: "belege/shell-frankfurt-ost.pdf", groesse: "120 KB", typ: "Beleg" },
    { name: "belege/gasthaus-adler.pdf", groesse: "85 KB", typ: "Beleg" },
    { name: "belege/riedel-chemie.xml", groesse: "12 KB", typ: "ZUGFeRD" },
  ],
};

// ── Tab IDs ──────────────────────────────────────────────────────────────

const TABS = [
  { id: "datev", label: "DATEV", icon: Download },
  { id: "lexware", label: "Lexware / CSV", icon: FileSpreadsheet },
  { id: "steuerberater", label: "Steuerberater-ZIP", icon: FolderArchive },
  { id: "bwa", label: "BWA", icon: TrendingUp },
  { id: "steuerprofil", label: "Steuerprofil", icon: Banknote },
  { id: "fristen", label: "Fristen", icon: CalendarClock },
];

function ExportContent() {
  usePageView();
  const searchParams = useSearchParams();
  const initialFormat = searchParams?.get("format") ?? "datev";
  const [activeFormat, setActiveFormat] = useState(initialFormat);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    const provider = getBuchhaltungProvider();
    const now = new Date();
    const zeitraum = {
      von: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
      bis: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`,
    };

    let result;
    if (activeFormat === "datev") result = await provider.exportDatev(zeitraum);
    else if (activeFormat === "lexware") result = await provider.exportLexware(zeitraum);
    else result = await provider.exportSteuerberaterPaket(zeitraum);

    setExported(`${result.dateiname} (${result.anzahlBuchungen} Buchungen)`);
    setExporting(false);
  };

  const isExportTab = ["datev", "lexware", "steuerberater"].includes(activeFormat);

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Auswertung & Export</span>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <Link href="/buchhaltung" className="w-9 h-9 rounded-full bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4 text-navy-900" />
        </Link>
        <h1 className="text-2xl font-extrabold text-navy-900">Auswertung & Export</h1>
      </div>
      <p className="text-sm text-text-muted mb-6 ml-12">BWA, Steuerprofil, DATEV, Lexware, Steuerberater-Paket, Fristen.</p>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 mb-6 pb-1 border-b border-neutral-gray-200 scrollbar-none">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setActiveFormat(t.id); setExported(null); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors min-h-[44px] ${
                activeFormat === t.id ? "border-navy-900 text-navy-900" : "border-transparent text-text-muted hover:text-navy-900"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Export Success */}
      {exported && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Export erfolgreich (Demo)</p>
            <p className="text-xs text-emerald-700">{exported}</p>
          </div>
        </div>
      )}

      {/* ── DATEV Tab ─────────────────────────────────────────────────── */}
      {activeFormat === "datev" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy-900 mb-1">DATEV-EXTF Vorschau</h2>
            <p className="text-sm text-text-muted mb-4">Buchungsstapel im EXTF-Format (SKR03) inkl. Belegbilder.</p>

            {/* Header */}
            <div className="bg-neutral-50 rounded-xl p-3 mb-4 overflow-x-auto">
              <code className="text-[10px] text-neutral-600 whitespace-nowrap font-mono">{DATEV_PREVIEW.header}</code>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-neutral-50 text-left">
                    <th className="px-3 py-2 font-bold text-neutral-500">Umsatz</th>
                    <th className="px-3 py-2 font-bold text-neutral-500">S/H</th>
                    <th className="px-3 py-2 font-bold text-neutral-500">Konto</th>
                    <th className="px-3 py-2 font-bold text-neutral-500">Gegenkonto</th>
                    <th className="px-3 py-2 font-bold text-neutral-500">Datum</th>
                    <th className="px-3 py-2 font-bold text-neutral-500">Beleg</th>
                    <th className="px-3 py-2 font-bold text-neutral-500">Buchungstext</th>
                    <th className="px-3 py-2 font-bold text-neutral-500">USt</th>
                  </tr>
                </thead>
                <tbody>
                  {DATEV_PREVIEW.rows.map((r, i) => (
                    <tr key={i} className="border-t border-neutral-100 hover:bg-neutral-50">
                      <td className="px-3 py-2 font-bold text-navy-900">{r.umsatz} €</td>
                      <td className="px-3 py-2 text-neutral-600">{r.sh}</td>
                      <td className="px-3 py-2 font-mono text-neutral-600">{r.konto}</td>
                      <td className="px-3 py-2 font-mono text-neutral-600">{r.gkonto}</td>
                      <td className="px-3 py-2 text-neutral-600">{r.datum}</td>
                      <td className="px-3 py-2 font-mono text-neutral-400">{r.beleg}</td>
                      <td className="px-3 py-2 text-navy-900 truncate max-w-[200px]">{r.text}</td>
                      <td className="px-3 py-2 text-neutral-600">{r.ust}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-text-muted mt-3">Hinweis: Im Echtbetrieb wird der Export mit dem DATEV-Prüfprogramm validiert.</p>
          </div>
        </div>
      )}

      {/* ── Lexware Tab ───────────────────────────────────────────────── */}
      {activeFormat === "lexware" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy-900 mb-1">Lexware / CSV Vorschau</h2>
            <p className="text-sm text-text-muted mb-4">Standard-CSV für Lexware oder Excel-Tabellenkalkulation.</p>

            <div className="bg-neutral-50 rounded-xl p-3 mb-4 overflow-x-auto">
              <code className="text-[10px] text-neutral-600 whitespace-nowrap font-mono">{LEXWARE_PREVIEW.header}</code>
            </div>

            <div className="space-y-1">
              {LEXWARE_PREVIEW.rows.map((row, i) => (
                <div key={i} className="bg-neutral-50 rounded-lg p-2 overflow-x-auto">
                  <code className="text-[10px] text-neutral-600 whitespace-nowrap font-mono">{row}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Steuerberater-ZIP Tab ─────────────────────────────────────── */}
      {activeFormat === "steuerberater" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy-900 mb-1">Steuerberater-Paket</h2>
            <p className="text-sm text-text-muted mb-4">Komplettpaket: kontierte Buchungen, Belege, BWA — ein ZIP, ein Klick.</p>

            <div className="bg-neutral-50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <FolderArchive className="w-5 h-5 text-accent-orange" />
                <span className="text-sm font-extrabold text-navy-900">{STEUERBERATER_ZIP.dateiname}</span>
              </div>
              <div className="space-y-2">
                {STEUERBERATER_ZIP.dateien.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs pl-6">
                    <span className="text-neutral-400">├──</span>
                    <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="font-mono text-navy-900 flex-1 truncate">{d.name}</span>
                    <span className="text-neutral-400 shrink-0">{d.groesse}</span>
                    <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0">{d.typ}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Action — only for export tabs */}
      {isExportTab && (
        <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-6 mt-5">
          <h2 className="text-base font-extrabold text-navy-900 mb-2">Export starten</h2>
          <p className="text-sm text-text-muted mb-4">
            Format: <strong>{TABS.find(f => f.id === activeFormat)?.label}</strong> · Zeitraum: laufender Monat
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors active:scale-[0.98] disabled:opacity-50 min-h-[48px]"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Wird exportiert..." : "Jetzt exportieren (Demo)"}
          </button>
          <p className="text-[10px] text-text-muted mt-3">Demo-Modus: Erzeugt eine Mock-Datei. Echte DATEV-API und ZIP-Erstellung folgen mit dem Provider.</p>
        </div>
      )}

      {/* ── BWA Tab ───────────────────────────────────────────────────── */}
      {activeFormat === "bwa" && (
        <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-navy-900 mb-1">BWA · Monatsübersicht</h2>
              <p className="text-sm text-text-muted">Betriebswirtschaftliche Auswertung — laufender Monat</p>
            </div>
            <Link href="/buchhaltung/bwa" className="text-xs font-bold text-accent-orange flex items-center gap-1 hover:gap-2 transition-all">
              Vollständige BWA <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <KpiBox label="Umsatzerlöse" value="85.400 €" color="text-navy-900" />
            <KpiBox label="Materialaufwand" value="12.200 €" color="text-rose-600" />
            <KpiBox label="Fixkosten" value="45.000 €" color="text-amber-600" />
            <KpiBox label="Ergebnis" value="+23.700 €" color="text-emerald-600" />
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-700"><strong>Positives Betriebsergebnis.</strong> Deckungsbeitrag bei 80,4 %. Materialquote 14,3 % liegt im Branchennormbereich.</p>
          </div>
        </div>
      )}

      {/* ── Steuerprofil Tab ──────────────────────────────────────────── */}
      {activeFormat === "steuerprofil" && (
        <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-navy-900 mb-1">Steuerprofil</h2>
              <p className="text-sm text-text-muted">Einstellungen für USt, Voranmeldung und Kontenrahmen</p>
            </div>
            <Link href="/buchhaltung/steuerprofil" className="text-xs font-bold text-accent-orange flex items-center gap-1 hover:gap-2 transition-all">
              Vollständig öffnen <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProfileRow label="Unternehmen" value="Galvanik Kreile" />
            <ProfileRow label="Sachkontenrahmen" value="SKR03" />
            <ProfileRow label="Standard-USt" value="19 %" />
            <ProfileRow label="Ermäßigt" value="7 %" />
            <ProfileRow label="Kleinunternehmer" value="Nein" />
            <ProfileRow label="Voranmeldung" value="Monatlich" />
          </div>
        </div>
      )}

      {/* ── Fristen Tab ───────────────────────────────────────────────── */}
      {activeFormat === "fristen" && (
        <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-navy-900 mb-1">Fristen & Pflichten</h2>
              <p className="text-sm text-text-muted">Automatisch überwacht — rechtzeitige Erinnerung</p>
            </div>
            <Link href="/buchhaltung/fristen" className="text-xs font-bold text-accent-orange flex items-center gap-1 hover:gap-2 transition-all">
              Vollständig öffnen <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            <FristRow titel="UStVA-Abgabe" frist="10. des Folgemonats" status="überwacht" />
            <FristRow titel="Gewerbesteuer-Vorauszahlung" frist="15.02 / 15.05 / 15.08 / 15.11" status="überwacht" />
            <FristRow titel="Rundfunkbeitrag" frist="Quartalsmitte" status="überwacht" />
            <FristRow titel="Jahresabschluss" frist="31. Dezember (Folgejahr)" status="geplant" />
          </div>
        </div>
      )}

      <FeedbackFooter pageTitle="Export" route="/buchhaltung/export" variant="full" />
    </div>
  );
}

function KpiBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-neutral-50 rounded-xl p-3">
      <div className={`text-lg font-extrabold ${color}`}>{value}</div>
      <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
      <span className="text-xs font-semibold text-text-muted">{label}</span>
      <span className="text-sm font-bold text-navy-900">{value}</span>
    </div>
  );
}

function FristRow({ titel, frist, status }: { titel: string; frist: string; status: string }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-neutral-50 rounded-xl">
      <CalendarClock className="w-4 h-4 text-accent-orange shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-navy-900">{titel}</div>
        <div className="text-xs text-text-muted">{frist}</div>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
        status === "überwacht" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"
      }`}>
        {status}
      </span>
    </div>
  );
}

export default function ExportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" /></div>}>
      <ExportContent />
    </Suspense>
  );
}
