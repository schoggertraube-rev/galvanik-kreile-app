"use client";
import { usePageView } from "@/hooks/usePageView";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Settings, Shield, FileText, Cpu, Lock } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

export default function EinstellungenPage() {
  usePageView();
  const [skr, setSkr] = useState("SKR03");
  const [confidenceSchwelle, setConfidenceSchwelle] = useState(85);
  const [ocrAnbieter, setOcrAnbieter] = useState("mock");

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Einstellungen</span>
      </div>

      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Buchhaltung — Voreinstellungen</h1>
      <p className="text-sm text-text-muted mb-8">Einmal einstellen, dann läuft die Buchhaltung im Hintergrund.</p>

      <div className="space-y-6 max-w-3xl">
        {/* Kontenrahmen */}
        <Card title="Kontenrahmen" icon={<FileText className="w-5 h-5 text-accent-orange" />}>
          <div className="flex gap-3">
            {["SKR03", "SKR04"].map(s => (
              <button key={s} onClick={() => setSkr(s)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${skr === s ? "bg-navy-900 text-white" : "bg-white border border-neutral-gray-200 text-text-muted hover:text-navy-900"}`}>
                {s}
              </button>
            ))}
          </div>
        </Card>

        {/* Steuerberater */}
        <Card title="Steuerberater-Zuordnung" icon={<Shield className="w-5 h-5 text-emerald-500" />}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Berater-Nr.</label>
              <input type="text" placeholder="z. B. 1234567" className="w-full mt-1 px-3 py-2 border border-neutral-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy-900" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Mandanten-Nr.</label>
              <input type="text" placeholder="z. B. 10001" className="w-full mt-1 px-3 py-2 border border-neutral-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy-900" />
            </div>
          </div>
        </Card>

        {/* OCR */}
        <Card title="OCR-Anbieter" icon={<Cpu className="w-5 h-5 text-blue-500" />}>
          <div className="flex gap-3">
            {[
              { id: "mock", label: "Demo (Mock)" },
              { id: "klippa", label: "Klippa" },
              { id: "eagle", label: "Eagle Doc" },
            ].map(o => (
              <button key={o.id} onClick={() => setOcrAnbieter(o.id)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${ocrAnbieter === o.id ? "bg-navy-900 text-white" : "bg-white border border-neutral-gray-200 text-text-muted hover:text-navy-900"}`}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-text-muted mt-2">API-Keys werden serverseitig verwaltet — kein Geheimnis im Frontend.</p>
        </Card>

        {/* Confidence */}
        <Card title="Confidence-Schwelle" icon={<Settings className="w-5 h-5 text-amber-500" />}>
          <div className="flex items-center gap-4">
            <input type="range" min={50} max={99} value={confidenceSchwelle} onChange={e => setConfidenceSchwelle(+e.target.value)} className="flex-1 accent-navy-900" />
            <span className="text-lg font-extrabold text-navy-900 w-16 text-center">{confidenceSchwelle} %</span>
          </div>
          <p className="text-xs text-text-muted mt-1">Belege unter dieser Schwelle erhalten den Status &bdquo;prüfen&ldquo;.</p>
        </Card>

        {/* ELSTER Stufe 2 */}
        <Card title="ELSTER-Zertifikat" icon={<Lock className="w-5 h-5 text-red-500" />} stufe2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800 font-semibold">Stufe 2 — noch nicht aktiviert</p>
            <p className="text-xs text-amber-700 mt-1">Das Organisationszertifikat für den ELSTER-Direktversand kann hier hinterlegt werden, sobald der Antrag beim Finanzamt gestellt und bewilligt ist.</p>
          </div>
        </Card>

        {/* Bank Stufe 2 */}
        <Card title="Bankzugang (PSD2)" icon={<Lock className="w-5 h-5 text-red-500" />} stufe2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800 font-semibold">Stufe 2 — PSD2-Aggregator wird vorbereitet</p>
            <p className="text-xs text-amber-700 mt-1">Live-Bankumsätze werden über finAPI, GoCardless oder Tink angebunden. Aktuell Demo-Modus.</p>
          </div>
        </Card>
      </div>

      <FeedbackFooter pageTitle="Buchhaltung Einstellungen" route="/buchhaltung/einstellungen" variant="full" />
    </div>
  );
}

function Card({ title, icon, children, stufe2 }: { title: string; icon: React.ReactNode; children: React.ReactNode; stufe2?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-neutral-gray-50 flex items-center justify-center shrink-0">{icon}</div>
        <h2 className="text-base font-extrabold text-navy-900">{title}</h2>
        {stufe2 && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Stufe 2</span>}
      </div>
      {children}
    </div>
  );
}
