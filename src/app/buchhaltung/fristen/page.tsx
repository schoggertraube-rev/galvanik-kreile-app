"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import { usePageView } from "@/hooks/usePageView";
import Link from "next/link";
import { ChevronRight, AlertTriangle, Calendar } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

export default function FristenPage() {
  usePageView();

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Buchhaltung',href:'/buchhaltung'}, {label:'Fristen'}]} />
        <BackButton label="Buchhaltung" href="/buchhaltung" />
      </div>
      
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Fristen & Pflichten</span>
      </div>

      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Fristen & Pflichten</h1>
          <p className="text-sm text-text-muted">Steuer-, Melde- und Aufbewahrungsfristen im Überblick.</p>
        </div>
        <Link href="/kalender" className="flex items-center gap-2 px-4 py-2.5 bg-white text-navy-900 rounded-xl font-semibold text-sm border border-neutral-gray-200 hover:bg-neutral-gray-50 transition-colors">
          <Calendar className="w-4 h-4" /> Zum Kalender
        </Link>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-4">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
        <div>
          <h2 className="font-extrabold text-amber-900">Keine bestätigte Fristenquelle angebunden</h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            Gesetzliche, individuelle und durch Steuerberatung verlängerte Fristen werden hier nicht aus statischen Regeln errechnet. Verbindliche Termine erscheinen erst nach Anbindung einer gepflegten Quelle mit Zeitraum, Mandantenbezug und Herkunftsnachweis.
          </p>
          <p className="mt-3 text-xs font-semibold text-amber-900">Bis dahin gelten Steuerberatung, Behördenbescheid und bestätigter Kalender als maßgeblich.</p>
        </div>
      </div>

      <FeedbackFooter pageTitle="Fristen" route="/buchhaltung/fristen" variant="full" />
    </div>
  );
}
