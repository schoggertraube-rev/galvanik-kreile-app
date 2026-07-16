"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, FolderArchive, Info } from "lucide-react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import { usePageView } from "@/hooks/usePageView";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { ExportDatei, Zeitraum } from "@/lib/buchhaltung/types";

export type ExportFormat = "datev" | "lexware" | "steuerberater";

const FORMATS: {
  id: ExportFormat;
  label: string;
  icon: typeof Download;
  description: string;
  contents: string[];
}[] = [
  {
    id: "datev",
    label: "DATEV-CSV",
    icon: FileSpreadsheet,
    description: "DATEV-EXTF-Buchungsstapel aus festgeschriebenen Belegen im gewählten Zeitraum.",
    contents: ["EXTF-Kopf", "Buchungsspalten", "Festgeschriebene Buchungszeilen"],
  },
  {
    id: "lexware",
    label: "Lexware-CSV",
    icon: FileSpreadsheet,
    description: "Semikolongetrennte Buchungsdatei aus denselben festgeschriebenen Belegen.",
    contents: ["Spaltenkopf", "Festgeschriebene Buchungszeilen"],
  },
  {
    id: "steuerberater",
    label: "Steuerberater-ZIP",
    icon: FolderArchive,
    description: "Echtes ZIP mit DATEV-CSV, Lexware-CSV und maschinenlesbarem Manifest.",
    contents: ["DATEV-CSV", "Lexware-CSV", "manifest.json", "Keine Belegbilder/PDFs"],
  },
];

function currentMonth(): Zeitraum {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const two = (value: number) => String(value).padStart(2, "0");
  return {
    von: `${year}-${two(month + 1)}-01`,
    bis: `${year}-${two(month + 1)}-${two(new Date(year, month + 1, 0).getDate())}`,
  };
}

function downloadBlob(result: ExportDatei): void {
  const blob = result.inhalt instanceof Blob
    ? result.inhalt
    : new Blob([new Uint8Array(result.inhalt)], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = result.dateiname;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function ExportClient({ initialFormat }: { initialFormat: ExportFormat }) {
  usePageView();
  const defaultPeriod = useMemo(() => currentMonth(), []);
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [von, setVon] = useState(defaultPeriod.von);
  const [bis, setBis] = useState(defaultPeriod.bis);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Pick<ExportDatei, "dateiname" | "mimeType" | "anzahlBuchungen" | "zeitraum"> | null>(null);
  const selected = FORMATS.find((entry) => entry.id === format)!;

  const handleExport = async () => {
    setError(null);
    setReceipt(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis) || von > bis) {
      setError("Bitte einen gültigen Zeitraum auswählen.");
      return;
    }
    setExporting(true);
    try {
      const provider = getBuchhaltungProvider();
      const zeitraum = { von, bis };
      const result = format === "datev"
        ? await provider.exportDatev(zeitraum)
        : format === "lexware"
          ? await provider.exportLexware(zeitraum)
          : await provider.exportSteuerberaterPaket(zeitraum);
      downloadBlob(result);
      setReceipt({
        dateiname: result.dateiname,
        mimeType: result.mimeType,
        anzahlBuchungen: result.anzahlBuchungen,
        zeitraum: result.zeitraum,
      });
    } catch (cause) {
      console.error("Buchhaltungsexport fehlgeschlagen", cause);
      setError(cause instanceof Error ? cause.message : "Export konnte nicht erzeugt werden.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="w-full px-4 pb-24 sm:px-6 xl:px-8">
      <div className="mb-6">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Buchhaltung", href: "/buchhaltung" }, { label: "Export" }]} />
        <BackButton label="Buchhaltung" href="/buchhaltung" />
      </div>
      <h1 className="text-2xl font-extrabold text-navy-900">Buchhaltungsexport</h1>
      <p className="mt-2 text-sm text-text-muted">Exportiert ausschließlich belegte Buchungsdaten. Nicht enthaltene Artefakte werden nicht behauptet.</p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {FORMATS.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => { setFormat(entry.id); setReceipt(null); setError(null); }}
              className={`rounded-2xl border p-4 text-left transition ${format === entry.id ? "border-navy-900 bg-navy-900 text-white" : "border-neutral-200 bg-white text-navy-900"}`}
            >
              <Icon className="mb-3 h-5 w-5" />
              <div className="font-bold">{entry.label}</div>
              <div className={`mt-1 text-xs leading-5 ${format === entry.id ? "text-white/70" : "text-text-muted"}`}>{entry.description}</div>
            </button>
          );
        })}
      </div>

      <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-extrabold text-navy-900">{selected.label}</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          {selected.contents.map((item) => <li key={item}>• {item}</li>)}
        </ul>
        {format === "steuerberater" && (
          <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <Info className="h-4 w-4 shrink-0" />
            Das Manifest weist ausdrücklich <code>receiptsIncluded: false</code> aus. Belege, BWA und UStVA sind nicht Bestandteil dieses Pakets.
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-neutral-600">Von
            <input type="date" value={von} onChange={(event) => setVon(event.target.value)} className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal text-navy-900" />
          </label>
          <label className="text-xs font-bold text-neutral-600">Bis
            <input type="date" value={bis} onChange={(event) => setBis(event.target.value)} className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal text-navy-900" />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="mt-5 flex min-h-12 items-center gap-2 rounded-xl bg-navy-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> {exporting ? "Export wird erzeugt …" : `${selected.label} erzeugen`}
        </button>
        {error && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
        {receipt && (
          <div className="mt-4 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>
              <strong>Exportdatei erzeugt:</strong> {receipt.dateiname}<br />
              {receipt.anzahlBuchungen} Buchungen · {receipt.mimeType} · {receipt.zeitraum.von} bis {receipt.zeitraum.bis}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
