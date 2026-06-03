"use client";
import { usePageView } from "@/hooks/usePageView";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, CreditCard, QrCode, Smartphone, BarChart3, Lock, Info, Globe, Users, TrendingUp, ArrowLeft } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { useState } from "react";

const TABS = [
  { id: "provider", label: "Dienstleister", icon: CreditCard },
  { id: "links", label: "Links & QR", icon: QrCode },
  { id: "vor-ort", label: "Vor-Ort", icon: Smartphone },
  { id: "moral", label: "Zahlungsmoral", icon: BarChart3 },
  { id: "statistik", label: "Statistik", icon: Globe },
];

const MOCK_MORAL = [
  { kunde: "Metallbau Werner", tage: 8, status: "pünktlich", color: "text-emerald-600 bg-emerald-50" },
  { kunde: "Autohaus Schmidt", tage: 14, status: "pünktlich", color: "text-emerald-600 bg-emerald-50" },
  { kunde: "Industriewerk Mainz", tage: 32, status: "verspätet", color: "text-amber-600 bg-amber-50" },
  { kunde: "Galvano-Service Nord", tage: 45, status: "kritisch", color: "text-rose-600 bg-rose-50" },
  { kunde: "Optik Braun GmbH", tage: 7, status: "pünktlich", color: "text-emerald-600 bg-emerald-50" },
];

const MOCK_STATISTIK = {
  zahlungsarten: [
    { art: "Überweisung", anteil: 68, betrag: 42800, icon: "🏦" },
    { art: "Lastschrift", anteil: 18, betrag: 11340, icon: "📄" },
    { art: "Kartenzahlung", anteil: 9, betrag: 5670, icon: "💳" },
    { art: "PayPal", anteil: 3, betrag: 1890, icon: "📱" },
    { art: "Bar", anteil: 2, betrag: 1260, icon: "💶" },
  ],
  herkunft: [
    { land: "Deutschland", anteil: 82, kunden: 47 },
    { land: "Österreich", anteil: 8, kunden: 5 },
    { land: "Schweiz", anteil: 5, kunden: 3 },
    { land: "Niederlande", anteil: 3, kunden: 2 },
    { land: "Sonstige", anteil: 2, kunden: 1 },
  ],
  dienstleister: [
    { name: "Hausbank (Sparkasse)", anteil: 72, volumen: "45.360 €" },
    { name: "PayPal", anteil: 15, volumen: "9.450 €" },
    { name: "SumUp", anteil: 8, volumen: "5.040 €" },
    { name: "Stripe", anteil: 5, volumen: "3.150 €" },
  ],
};

function ZahlungContent() {
  usePageView();
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get("tab") ?? "provider";
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Zahlungsbereich</span>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <Link href="/buchhaltung" className="w-9 h-9 rounded-full bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4 text-navy-900" />
        </Link>
        <h1 className="text-2xl font-extrabold text-navy-900">Zahlungsbereich</h1>
      </div>
      <div className="flex items-center gap-2 mb-6 ml-12">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Stufe 2 — In Vorbereitung</span>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 mb-6 pb-1 border-b border-neutral-gray-200 scrollbar-none">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors min-h-[44px] ${
                activeTab === t.id ? "border-navy-900 text-navy-900" : "border-transparent text-text-muted hover:text-navy-900"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Zahlungsmoral Tab */}
      {activeTab === "moral" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy-900 mb-1">Zahlungsmoral</h2>
            <p className="text-sm text-text-muted mb-5">Durchschnittliche Zahlungsdauer der letzten 6 Monate nach Kunde.</p>

            <div className="space-y-3">
              {MOCK_MORAL.map((m, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-neutral-50 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-white border border-neutral-100 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-navy-900 truncate">{m.kunde}</div>
                    <div className="text-xs text-text-muted">Ø {m.tage} Tage</div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${m.color}`}>
                    {m.status}
                  </span>
                  {/* Bar */}
                  <div className="hidden sm:block w-24 h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${m.tage <= 14 ? "bg-emerald-500" : m.tage <= 30 ? "bg-amber-500" : "bg-rose-500"}`}
                      style={{ width: `${Math.min(100, (m.tage / 60) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Link to Analyse */}
          <Link href="/buchhaltung/zahlung?tab=statistik" className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 hover:bg-blue-100 transition-colors">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <div className="flex-1">
              <div className="text-sm font-bold text-blue-900">Zahlungsstatistik öffnen</div>
              <div className="text-xs text-blue-600">Zahlungsarten, Dienstleister-Verteilung, Herkunftsländer</div>
            </div>
            <ChevronRight className="w-4 h-4 text-blue-400" />
          </Link>
        </div>
      )}

      {/* Statistik Tab */}
      {activeTab === "statistik" && (
        <div className="space-y-5">
          {/* Zahlungsarten */}
          <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy-900 mb-1">Zahlungsarten-Verteilung</h2>
            <p className="text-sm text-text-muted mb-5">Wie deine Kunden bezahlen — letzte 12 Monate.</p>
            <div className="space-y-3">
              {MOCK_STATISTIK.zahlungsarten.map((z, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg w-8 text-center">{z.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-navy-900">{z.art}</span>
                      <span className="text-xs font-bold text-navy-900">{z.betrag.toLocaleString("de-DE")} € <span className="text-text-muted font-normal">({z.anteil} %)</span></span>
                    </div>
                    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${z.anteil}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dienstleister */}
          <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy-900 mb-1">Dienstleister-Verteilung</h2>
            <p className="text-sm text-text-muted mb-5">Über welche Anbieter die Zahlungen abgewickelt werden.</p>
            <div className="space-y-3">
              {MOCK_STATISTIK.dienstleister.map((d, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-neutral-50 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-white border border-neutral-100 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-teal-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-navy-900">{d.name}</div>
                    <div className="text-xs text-text-muted">{d.anteil} % · {d.volumen}</div>
                  </div>
                  <div className="w-16 h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${d.anteil}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Herkunft */}
          <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-navy-900 mb-1">Herkunftsländer der Kunden</h2>
            <p className="text-sm text-text-muted mb-5">Woher kommen die zahlenden Kunden.</p>
            <div className="space-y-3">
              {MOCK_STATISTIK.herkunft.map((h, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-neutral-50 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-white border border-neutral-100 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-navy-900">{h.land}</div>
                    <div className="text-xs text-text-muted">{h.kunden} Kunden · {h.anteil} %</div>
                  </div>
                  <div className="w-16 h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-purple-500" style={{ width: `${h.anteil}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Link zurück */}
          <Link href="/buchhaltung/zahlung?tab=moral" className="flex items-center gap-3 bg-neutral-50 border border-neutral-200 rounded-xl p-4 hover:bg-neutral-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-neutral-500" />
            <span className="text-sm font-bold text-navy-900">Zurück zur Zahlungsmoral</span>
          </Link>
        </div>
      )}

      {/* Other Tabs (provider, links, vor-ort) — Stufe 2 Info */}
      {(activeTab === "provider" || activeTab === "links" || activeTab === "vor-ort") && (
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
              </h2>
              <p className="text-sm text-text-muted mt-1">
                {activeTab === "provider" && "Stripe, Mollie oder SumUp für Kartenzahlung und Checkout. Anbindung erfolgt in Stufe 2, sobald die Geschäftsbedingungen geklärt sind."}
                {activeTab === "links" && "Rechnungen per Link oder QR-Code bezahlen lassen. Ideal für Abholer und Fernkunden. Anbindung an den gewählten Zahlungsdienstleister."}
                {activeTab === "vor-ort" && "Terminal oder Tap-to-Pay bei Abholung (SumUp, Zettle). Szenario hängt vom Zahlungsdienstleister ab."}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <Lock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-amber-800">Stufe 2 — wird aktiviert, sobald Feature-Flag freigeschaltet</p>
            <p className="text-xs text-amber-700 mt-1">Voreinstellungen können unter <Link href="/buchhaltung/einstellungen" className="underline font-bold">Buchhaltung → Einstellungen</Link> vorbereitet werden.</p>
          </div>
        </div>
      )}

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
