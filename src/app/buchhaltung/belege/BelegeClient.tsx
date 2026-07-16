"use client";

import { createBelegAction } from "@/app/buchhaltung/actions";
import { BelegUploadOverlay } from "@/components/buchhaltung/BelegUploadOverlay";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { BackButton } from "@/components/ui/BackButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { usePageView } from "@/hooks/usePageView";
import type { Beleg, BelegStatus } from "@/lib/buchhaltung/types";
import { Camera, CircleAlert, ReceiptText, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

type Props = {
  initialBelege: Beleg[];
  activeStatus: BelegStatus | null;
  activeView: string | null;
};

const STATUS_LABELS: Record<BelegStatus, string> = {
  pruefen: "Prüfen",
  erfasst: "Erfasst",
  festgeschrieben: "Festgeschrieben",
  storniert: "Storniert",
};

const STATUS_FILTERS: Array<{ value: BelegStatus | null; label: string }> = [
  { value: null, label: "Alle" },
  { value: "pruefen", label: "Prüfen" },
  { value: "erfasst", label: "Erfasst" },
  { value: "festgeschrieben", label: "Festgeschrieben" },
  { value: "storniert", label: "Storniert" },
];

const VIEW_FILTERS = [
  { value: null, label: "Alle Zuordnungen" },
  { value: "missingKonto", label: "Konto fehlt" },
  { value: "missingKostenstelle", label: "Kostenstelle fehlt" },
  { value: "nichtAufAuftrag", label: "Kein Auftrag" },
] as const;

function money(value: number | undefined): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value ?? 0);
}

function date(value: string | undefined): string {
  if (!value) return "Kein Belegdatum";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "Ungültiges Datum" : parsed.toLocaleDateString("de-DE", { timeZone: "UTC" });
}

export function BelegeClient({ initialBelege, activeStatus, activeView }: Props) {
  usePageView();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMode, setOverlayMode] = useState<"foto" | "upload">("upload");
  const belege = initialBelege;

  const totals = useMemo(() => ({
    gross: belege.filter((item) => item.status !== "storniert").reduce((sum, item) => sum + (item.brutto ?? 0), 0),
    review: belege.filter((item) => item.status === "pruefen").length,
  }), [belege]);

  const setFilter = (key: "status" | "view", value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/buchhaltung/belege${next.size ? `?${next.toString()}` : ""}`);
  };

  const openOverlay = useCallback((mode: "foto" | "upload") => {
    setOverlayMode(mode);
    setOverlayOpen(true);
  }, []);

  const handleUploadSubmit = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    await createBelegAction(formData);
    router.refresh();
  }, [router]);

  return (
    <div className="min-h-screen w-full px-4 pb-24 sm:px-6 xl:px-8">
      <div className="mb-6">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Buchhaltung", href: "/buchhaltung" }, { label: "Belege" }]} />
        <BackButton label="Buchhaltung" href="/buchhaltung" />
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ReceiptText className="h-7 w-7 text-rose-500" />
            <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">Belege & Ausgaben</h1>
          </div>
          <p className="mt-2 text-xs font-semibold text-text-muted">Serverdatenbank · {belege.length} Treffer · Summe ohne Storno {money(totals.gross)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openOverlay("foto")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-900 px-4 py-2 text-sm font-bold text-white">
            <Camera className="h-4 w-4" /> Foto verarbeiten
          </button>
          <button type="button" onClick={() => openOverlay("upload")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-navy-900">
            <Upload className="h-4 w-4" /> Datei verarbeiten
          </button>
        </div>
      </div>

      {totals.review > 0 && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {totals.review} Belege im aktuellen Trefferbestand müssen geprüft werden.
        </div>
      )}

      <div className="mb-5 space-y-3 rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
        <FilterRow label="Status">
          {STATUS_FILTERS.map((filter) => (
            <FilterButton key={filter.label} active={activeStatus === filter.value} onClick={() => setFilter("status", filter.value)}>{filter.label}</FilterButton>
          ))}
        </FilterRow>
        <FilterRow label="Zuordnung">
          {VIEW_FILTERS.map((filter) => (
            <FilterButton key={filter.label} active={activeView === filter.value} onClick={() => setFilter("view", filter.value)}>{filter.label}</FilterButton>
          ))}
        </FilterRow>
      </div>

      <section className="rounded-2xl border border-neutral-100 bg-white p-3 shadow-sm" aria-label="Belegliste">
        {belege.length === 0 ? (
          <p className="py-12 text-center text-sm text-text-muted">Für diesen Filter wurden keine Belege gefunden.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {belege.map((item) => (
              <Link key={item.id} href={`/buchhaltung/belege/${item.id}`} className="grid gap-3 rounded-xl p-4 hover:bg-neutral-50 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-navy-900">{item.lieferantText?.trim() || "Lieferant nicht erfasst"}</p>
                  <p className="mt-1 text-xs text-text-muted">{date(item.belegdatum)} · {item.belegart || "Belegart nicht erfasst"} · {item.kategorieId ? "Kategorie zugeordnet" : "Kategorie fehlt"}</p>
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === "pruefen" ? "bg-amber-50 text-amber-700" : item.status === "storniert" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {STATUS_LABELS[item.status]}
                </span>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-extrabold text-navy-900">{money(item.brutto)}</p>
                  <p className="text-[10px] text-text-muted">Vorsteuer {money(item.ustBetrag)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="mt-4 text-xs text-text-muted">Es werden nur bestätigte Serverdatensätze angezeigt. OCR-Ergebnisse sind Vorschläge und müssen bei Status „Prüfen“ kontrolliert werden.</p>

      <BelegUploadOverlay open={overlayOpen} onClose={() => setOverlayOpen(false)} onSubmit={handleUploadSubmit} mode={overlayMode} />
      <FeedbackFooter pageTitle="Belege" route="/buchhaltung/belege" variant="full" />
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-bold uppercase tracking-wide text-text-muted">{label}</span>{children}</div>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? "bg-navy-900 text-white" : "border border-neutral-200 bg-white text-text-muted"}`}>{children}</button>;
}
