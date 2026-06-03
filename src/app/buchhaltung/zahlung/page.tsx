"use client";
import { usePageView } from "@/hooks/usePageView";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, CreditCard, QrCode, Smartphone, BarChart3, Lock, Info } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { useState } from "react";

const TABS = [
  { id: "provider", label: "Zahlungsdienstleister", icon: CreditCard },
  { id: "links", label: "Zahlungslink & QR", icon: QrCode },
  { id: "vor-ort", label: "Vor-Ort-Zahlung", icon: Smartphone },
  { id: "moral", label: "Zahlungsmoral", icon: BarChart3 },
];

function ZahlungContent() {
  usePageView();
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get("tab") ?? "provider";
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Zahlungsbereich</span>
      </div>

      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Zahlungsbereich</h1>
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Stufe 2 — In Vorbereitung</span>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-1 border-b border-neutral-gray-200">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.id ? "border-navy-900 text-navy-900" : "border-transparent text-text-muted hover:text-navy-900"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Inhalt */}
      <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <Info className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-navy-900">
              {activeTab === "provider" && "Zahlungsdienstleister auswählen"}
              {activeTab === "links" && "Zahlungslink & QR-Code"}
              {activeTab === "vor-ort" && "Vor-Ort-Zahlung"}
              {activeTab === "moral" && "Zahlungsmoral & Zahlungsarten"}
            </h2>
            <p className="text-sm text-text-muted mt-1">
              {activeTab === "provider" && "Stripe, Mollie oder SumUp für Kartenzahlung und Checkout. Anbindung erfolgt in Stufe 2, sobald die Geschäftsbedingungen geklärt sind."}
              {activeTab === "links" && "Rechnungen per Link oder QR-Code bezahlen lassen. Ideal für Abholer und Fernkunden. Anbindung an den gewählten Zahlungsdienstleister."}
              {activeTab === "vor-ort" && "Terminal oder Tap-to-Pay bei Abholung (SumUp, Zettle). Szenario hängt vom Zahlungsdienstleister ab."}
              {activeTab === "moral" && "Auswertung: Welche Kunden zahlen pünktlich? Welche Zahlungsarten dominieren? Datenbasis wächst mit Live-Bank-Anbindung (Stufe 2)."}
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <Lock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-amber-800">Stufe 2 — wird aktiviert, sobald Feature-Flag freigeschaltet</p>
          <p className="text-xs text-amber-700 mt-1">Voreinstellungen können unter <Link href="/buchhaltung/einstellungen" className="underline font-bold">Buchhaltung → Einstellungen</Link> vorbereitet werden.</p>
        </div>
      </div>

      <FeedbackFooter pageTitle="Zahlung" route="/buchhaltung/zahlung" variant="full" />
    </div>
  );
}

export default function ZahlungPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" /></div>}>
      <ZahlungContent />
    </Suspense>
  );
}
