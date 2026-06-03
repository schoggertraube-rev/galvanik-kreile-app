"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, ArrowLeft, Save, ShieldCheck, XCircle, FileText, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

interface BelegDetailClientProps {
  id: string;
}

interface MockBeleg {
  id: string;
  name: string;
  date: string;
  brutto: number;
  netto: number;
  ustSatz: number;
  ustBetrag: number;
  categoryId: string;
  categoryName: string;
  skrKonto: string;
  absetzbarProzent: number;
  absetzbarGrund: string;
  belegart: string;
  confidence: number;
  status: "pruefen" | "erfasst" | "festgeschrieben" | "storniert";
  icon: string;
  info: string;
  belegnummer: string;
  notiz: string;
  kiHinweise: { regel: string; text: string; paragraf: string; typ: "warning" | "info" | "success" }[];
  audit: { aktion: string; zeitpunkt: string; benutzer: string }[];
}

const MOCK_BELEGE: Record<string, MockBeleg> = {
  "shell-frankfurt-ost": {
    id: "shell-frankfurt-ost", name: "Shell - Frankfurt-Ost", date: "2026-06-02", brutto: 78.40, netto: 65.88, ustSatz: 19, ustBetrag: 12.52,
    categoryId: "kraftstoff", categoryName: "Kraftstoff", skrKonto: "4530", absetzbarProzent: 100, absetzbarGrund: "Betrieblicher Fuhrpark",
    belegart: "Tankbeleg", confidence: 96.1, status: "erfasst", icon: "FOTO", info: "Diesel 45,8 l", belegnummer: "SH-2026-4829", notiz: "",
    kiHinweise: [
      { regel: "Kraftstoff plausibel", text: "Verbrauch und Betrag passen zum Fuhrpark. Keine Auffälligkeiten.", paragraf: "", typ: "success" },
      { regel: "Vorsteuer", text: "Voller Vorsteuerabzug bei betrieblichem Fahrzeug möglich.", paragraf: "§ 15 UStG", typ: "info" },
    ],
    audit: [
      { aktion: "Erfasst (Foto)", zeitpunkt: "02.06.2026, 08:14", benutzer: "MK" },
      { aktion: "OCR verarbeitet", zeitpunkt: "02.06.2026, 08:14", benutzer: "System" },
      { aktion: "Automatisch zugeordnet", zeitpunkt: "02.06.2026, 08:14", benutzer: "KI" },
    ],
  },
  "gasthaus-adler": {
    id: "gasthaus-adler", name: "Gasthaus Adler", date: "2026-05-31", brutto: 64.00, netto: 53.78, ustSatz: 19, ustBetrag: 10.22,
    categoryId: "bewirtung", categoryName: "Bewirtung", skrKonto: "4650", absetzbarProzent: 70, absetzbarGrund: "Bewirtung (§ 4 Abs. 5 Nr. 2 EStG)",
    belegart: "Bewirtungsbeleg", confidence: 72.5, status: "pruefen", icon: "FOTO", info: "Anlass fehlt", belegnummer: "GA-2026-0531", notiz: "",
    kiHinweise: [
      { regel: "Bewirtung 70 %", text: "Nur 70 % der Bewirtungskosten sind absetzbar. Anlass und Teilnehmer müssen auf der Rückseite vermerkt sein.", paragraf: "§ 4 Abs. 5 Nr. 2 EStG", typ: "warning" },
      { regel: "Pflichtangaben fehlen", text: "Anlass der Bewirtung und Teilnehmerliste fehlen. Bitte ergänzen, sonst droht Nichtanerkennung.", paragraf: "", typ: "warning" },
    ],
    audit: [
      { aktion: "Erfasst (Foto)", zeitpunkt: "31.05.2026, 19:45", benutzer: "MK" },
      { aktion: "OCR verarbeitet", zeitpunkt: "31.05.2026, 19:45", benutzer: "System" },
      { aktion: "Zur Prüfung markiert", zeitpunkt: "31.05.2026, 19:46", benutzer: "KI" },
    ],
  },
  "riedel-chemie": {
    id: "riedel-chemie", name: "Riedel Chemie GmbH", date: "2026-05-30", brutto: 1190.00, netto: 1000.00, ustSatz: 19, ustBetrag: 190.00,
    categoryId: "material", categoryName: "Material & Chemie", skrKonto: "3400", absetzbarProzent: 100, absetzbarGrund: "Betriebsausgabe",
    belegart: "E-Rechnung (ZUGFeRD)", confidence: 98.3, status: "erfasst", icon: "PDF", info: "E-Rechnung (ZUGFeRD)", belegnummer: "RC-2026-1847", notiz: "",
    kiHinweise: [
      { regel: "E-Rechnung validiert", text: "ZUGFeRD-Struktur wurde geprüft und ist gültig. Alle Pflichtfelder vorhanden.", paragraf: "", typ: "success" },
    ],
    audit: [
      { aktion: "E-Rechnung importiert", zeitpunkt: "30.05.2026, 10:30", benutzer: "System" },
      { aktion: "ZUGFeRD geparst", zeitpunkt: "30.05.2026, 10:30", benutzer: "System" },
      { aktion: "Automatisch zugeordnet", zeitpunkt: "30.05.2026, 10:30", benutzer: "KI" },
    ],
  },
};

export function BelegDetailClient({ id }: BelegDetailClientProps) {
  usePageView();

  const beleg = useMemo(() => MOCK_BELEGE[id] ?? null, [id]);

  // Editable form state
  const [form, setForm] = useState(() => beleg ? {
    lieferant: beleg.name,
    datum: beleg.date,
    belegnummer: beleg.belegnummer,
    brutto: beleg.brutto.toString(),
    netto: beleg.netto.toString(),
    ustSatz: beleg.ustSatz.toString(),
    ustBetrag: beleg.ustBetrag.toString(),
    kategorie: beleg.categoryName,
    skrKonto: beleg.skrKonto,
    absetzbar: beleg.absetzbarProzent.toString(),
    notiz: beleg.notiz,
  } : null);

  const [status, setStatus] = useState<string>(beleg?.status ?? "erfasst");
  const [toast, setToast] = useState<string | null>(null);
  const [stornoOpen, setStornoOpen] = useState(false);
  const [stornoGrund, setStornoGrund] = useState("");

  if (!beleg || !form) {
    return (
      <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 min-h-screen">
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

  const handleSave = () => {
    if (!form.lieferant || !form.brutto) {
      showToast("Pflichtfelder fehlen: Lieferant und Brutto sind erforderlich.");
      return;
    }
    showToast("Korrektur gespeichert. Im GoBD-Modus wird jede Korrektur über Audit-Log nachvollzogen.");
  };

  const handleFreigabe = () => {
    setStatus("festgeschrieben");
    showToast("Beleg freigegeben. Spätere GoBD-Festschreibung erfolgt mit Backend-Trigger.");
  };

  const handleStorno = () => {
    if (!stornoGrund.trim()) {
      showToast("Bitte Storno-Grund angeben.");
      return;
    }
    setStatus("storniert");
    setStornoOpen(false);
    showToast("Storno vorbereitet. Gegenbuchung wird im Mock erzeugt. Keine echte Datenlöschung.");
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
        <span className="text-navy-900 truncate max-w-[200px]">{beleg.name}</span>
      </div>

      {/* Back + Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/buchhaltung/belege" className="w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4 text-[#1e1b18]" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1e1b18] tracking-tight">{beleg.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wide uppercase ${statusColorClass}`}>{statusLabel}</span>
              <span className="text-xs text-neutral-500">{beleg.belegart} · {beleg.belegnummer}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl sm:text-3xl font-extrabold text-[#1e1b18]">{beleg.brutto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
          <div className="text-xs text-neutral-400 mt-0.5">Confidence: {beleg.confidence.toFixed(1)} %</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Preview + Form */}
        <div className="lg:col-span-2 space-y-6">

          {/* Preview */}
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-4 sm:p-6">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Original-Beleg</h3>
            <div className="bg-neutral-50 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[120px] border border-neutral-100">
              <FileText className="w-16 h-16 text-neutral-200 mb-3" />
              <p className="text-xs text-neutral-400 font-bold">{beleg.icon} — {beleg.belegart}</p>
              <p className="text-[10px] text-neutral-400 mt-1">Original wird später GoBD-sicher im Storage abgelegt.</p>
            </div>
          </div>

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
              <FormField label="Kategorie" value={form.kategorie} onChange={v => setForm({ ...form, kategorie: v })} />
              <FormField label="SKR-Konto" value={form.skrKonto} onChange={v => setForm({ ...form, skrKonto: v })} />
              <FormField label="Absetzbarkeit (%)" value={form.absetzbar} onChange={v => setForm({ ...form, absetzbar: v })} />
              <div className="sm:col-span-2">
                <FormField label="Notiz" value={form.notiz} onChange={v => setForm({ ...form, notiz: v })} multiline />
              </div>
            </div>

            <p className="text-[10px] text-neutral-400 mt-4">Im späteren GoBD-Modus wird jede Korrektur über Audit-Log/Storno nachvollzogen.</p>
          </div>
        </div>

        {/* Right: KI + Audit + Actions */}
        <div className="space-y-6">

          {/* KI Hinweise */}
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-4 sm:p-6">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">KI-/Regelhinweise</h3>
            <div className="space-y-3">
              {beleg.kiHinweise.map((h, i) => (
                <div key={i} className={`rounded-xl p-3 text-xs ${h.typ === "warning" ? "bg-amber-50 border border-amber-200" : h.typ === "success" ? "bg-emerald-50 border border-emerald-200" : "bg-blue-50 border border-blue-200"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {h.typ === "warning" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : h.typ === "success" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
                    <span className={`font-extrabold ${h.typ === "warning" ? "text-amber-800" : h.typ === "success" ? "text-emerald-800" : "text-blue-800"}`}>{h.regel}</span>
                  </div>
                  <p className={`${h.typ === "warning" ? "text-amber-700" : h.typ === "success" ? "text-emerald-700" : "text-blue-700"}`}>{h.text}</p>
                  {h.paragraf && <p className="text-[10px] text-neutral-400 mt-1">{h.paragraf}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Audit */}
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-4 sm:p-6">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Audit-Historie</h3>
            <div className="space-y-3">
              {beleg.audit.map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Clock className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#1e1b18]">{a.aktion}</p>
                    <p className="text-[10px] text-neutral-400">{a.zeitpunkt} · {a.benutzer}</p>
                  </div>
                </div>
              ))}
              {status === "festgeschrieben" && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-700">Freigegeben</p>
                    <p className="text-[10px] text-neutral-400">Soeben · Benutzer</p>
                  </div>
                </div>
              )}
              {status === "storniert" && (
                <div className="flex items-start gap-3">
                  <XCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-rose-700">Storno vorbereitet</p>
                    <p className="text-[10px] text-neutral-400">Soeben · Benutzer · Grund: {stornoGrund}</p>
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
                disabled={status === "storniert"}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e1b18] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" /> Korrektur speichern
              </button>
              <button
                onClick={handleFreigabe}
                disabled={status === "festgeschrieben" || status === "storniert"}
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

function FormField({ label, value, onChange, type = "text", multiline = false }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
}) {
  const cls = "w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-[#1e1b18] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 min-h-[44px]";
  return (
    <div>
      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} className={cls} rows={2} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}
