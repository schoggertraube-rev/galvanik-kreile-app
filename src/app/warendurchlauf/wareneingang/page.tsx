"use client";

import Link from "next/link";
import {
  Camera, PenLine, Phone, MessageSquare, Clock,
  ChevronRight, Zap
} from "lucide-react";
import { useState } from "react";
import { WarendurchlaufIntakeWizard } from "@/components/warendurchlauf/WarendurchlaufIntakeWizard";

/* ═══════════════════════════════════════════
   Warendurchlauf Leitstand — v4 Layout
   ═══════════════════════════════════════════ */

export default function WarendurchlaufLeitstand() {
  const [wizardMode, setWizardMode] = useState<"camera" | "manual" | null>(null);

  return (
    <div className="w-full h-full font-sans antialiased text-[#1a1a1a]">
      {wizardMode && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm overflow-y-auto">
          <WarendurchlaufIntakeWizard
            initialMode={wizardMode}
            onClose={() => setWizardMode(null)}
          />
        </div>
      )}
      <div className="w-full mx-auto px-5 md:px-8 lg:px-12 xl:px-16 py-6">




        {/* ── UNTERER BEREICH ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,380px)] gap-6" style={{ animation: "fadeUp .4s .1s ease both" }}>

          {/* LINKE SEITE */}
          <div>
            {/* Titel */}
            <div className="text-[13px] font-bold text-[#5e5850] mb-3 flex items-center gap-2">
              Neue Annahme erfassen
              <span className="flex-1 h-px bg-[#d8d0c4]" />
            </div>

            {/* Aktionskarten */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {/* Kamera — primary */}
              <button
                onClick={() => setWizardMode("camera")}
                className="flex flex-col items-center gap-3 p-6 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md text-center text-white"
                style={{ background: "#1a6b38", border: "1.5px solid #1a6b38" }}
              >
                <div className="w-[52px] h-[52px] rounded-[14px] bg-white/15 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <span className="text-[15px] font-bold">Kamera</span>
                <span className="text-xs text-white/60">Foto &middot; Scan</span>
              </button>

              {/* Telefonnotiz (ersetzt Datei-Upload) */}
              <Link
                href="/telefonnotiz?source=warendurchlauf"
                className="flex flex-col items-center gap-3 p-6 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8] text-center"
                style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
              >
                <div className="w-[52px] h-[52px] rounded-[14px] bg-[#fef3e2] flex items-center justify-center">
                  <Phone className="w-6 h-6 text-[#2471a3]" />
                </div>
                <span className="text-[15px] font-bold text-[#1a1a1a]">Telefonnotiz</span>
                <span className="text-xs text-[#9e9689]">Schnellerfassung</span>
              </Link>

              {/* Manuell anlegen */}
              <button
                onClick={() => setWizardMode("manual")}
                className="flex flex-col items-center gap-3 p-6 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f4f0e8] text-center"
                style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
              >
                <div className="w-[52px] h-[52px] rounded-[14px] bg-[#fef3e2] flex items-center justify-center">
                  <PenLine className="w-6 h-6 text-[#c8922a]" />
                </div>
                <span className="text-[15px] font-bold text-[#1a1a1a]">Manuell anlegen</span>
                <span className="text-xs text-[#9e9689]">Kunde &middot; Auftrag</span>
              </button>
            </div>

            {/* Breite Verweiskarten */}
            <Link
              href="/quotes"
              className="flex items-center gap-4 p-4 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm hover:bg-[#f4f0e8] mb-3"
              style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
            >
              <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-[#c8922a]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#1a1a1a]">Anfragen</div>
                <div className="text-[11px] text-[#9e9689]">Offene Angebotsanfragen</div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9e9689] shrink-0" />
            </Link>

            <Link
              href="/orders"
              className="flex items-center gap-4 p-4 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm hover:bg-[#f4f0e8]"
              style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}
            >
              <div className="w-10 h-10 rounded-[10px] bg-[#fef3e2] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-[#c8922a]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#1a1a1a]">Letzte Annahmen</div>
                <div className="text-[11px] text-[#9e9689]">28 gesamt anzeigen</div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9e9689] shrink-0" />
            </Link>
          </div>

          {/* RECHTE SEITE */}
          <div className="flex flex-col gap-3">
            {/* Tagesstand */}
            <div className="p-3 rounded-[14px]" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
              <div className="text-[10px] font-bold tracking-[1px] uppercase text-[#9e9689] mb-2" style={{ fontFamily: "monospace" }}>
                Tagesstand
              </div>
              {/* Bar */}
              <div className="h-2 rounded flex gap-0.5 overflow-hidden mb-2">
                <div className="rounded bg-[#c0392b]" style={{ flex: 3 }} />
                <div className="rounded bg-[#d4850a]" style={{ flex: 5 }} />
                <div className="rounded bg-[#2471a3]" style={{ flex: 2 }} />
                <div className="rounded bg-[#1e7e45]" style={{ flex: 18 }} />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <StatRow color="#c0392b" label="Überfällig" value="3" />
                <StatRow color="#2471a3" label="Diese Woche" value="5" />
                <StatRow color="#d4850a" label="Wartend" value="2" />
                <StatRow color="#1e7e45" label="Im Plan" value="18" />
              </div>
            </div>

            {/* Checkliste */}
            <div className="p-3 rounded-[14px]" style={{ background: "#faf8f4", border: "1.5px solid #d8d0c4" }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-bold text-[#1a1a1a]">Checkliste Heute</span>
                <span
                  className="text-[9px] font-semibold px-2 py-[3px] rounded-[5px] border cursor-pointer uppercase tracking-[.4px]"
                  style={{ background: "#f4f0e8", borderColor: "#d8d0c4", color: "#5e5850" }}
                >
                  Auswertung
                </span>
              </div>

              {/* Hebel-Hinweis */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-[7px] bg-[#fef3e2] mb-2 text-[10px]">
                <Zap className="w-3 h-3 text-[#c8922a]" />
                <span className="text-[#5e5850]">Hebel: </span>
                <b className="text-[#c8922a]">Kritische Aufträge entschärfen</b>
              </div>

              {/* Items */}
              <div className="flex flex-col">
                <CheckItem
                  title="Salzsäure nachbestellen"
                  subtitle="Bestand unter 20%"
                  tags={["Chemie"]}
                  action="Lieferant"
                  priority="Hoch"
                  live
                />
                <CheckItem
                  title="Material fehlt #8102"
                  subtitle="Frontteile nicht auffindbar"
                  tags={["Eingang"]}
                  action="Palette suchen"
                  live
                />
                <CheckItem
                  title="QS: Teile nacharbeiten"
                  subtitle="2 Trommeln Nickel"
                  tags={["Galvanik"]}
                  action="Entlacken"
                  live
                />
              </div>
            </div>

            {/* Demo-Badge */}
            <div className="text-center">
              <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-[rgba(212,133,10,.1)] border border-[rgba(212,133,10,.2)] text-[#d4850a] uppercase tracking-wider">
                Demo-Daten
              </span>
            </div>
          </div>
        </div>
      </div>



      {/* Animation */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}


/* ── Hilfskomponenten ── */

function StatRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-[3px] text-[11px]">
      <div className="flex items-center gap-[5px] text-[#5e5850]">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <span className="font-bold text-[12px]" style={{ fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

function CheckItem({
  title,
  subtitle,
  tags,
  action,
  priority,
  live,
}: {
  title: string;
  subtitle: string;
  tags: string[];
  action: string;
  priority?: string;
  live?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-[7px] border-b border-[#d8d0c4] last:border-b-0 cursor-pointer transition-colors hover:bg-[#f4f0e8] hover:mx-[-6px] hover:px-[6px] hover:rounded-md">
      <div className="w-4 h-4 rounded-full border-2 border-[#d8d0c4] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-[#1a1a1a]">{title}</div>
        <div className="text-[10px] text-[#9e9689]">{subtitle}</div>
        <div className="flex gap-1 items-center mt-0.5 flex-wrap">
          {tags.map(t => (
            <span key={t} className="text-[8px] font-bold px-[5px] py-px rounded-[3px] bg-[#f4f0e8] text-[#5e5850] border border-[#d8d0c4]">{t}</span>
          ))}
          <span className="text-[9px] text-[#c8922a] font-semibold flex items-center gap-0.5">
            <Zap className="w-2.5 h-2.5" /> {action}
          </span>
        </div>
      </div>
      <div className="flex gap-[3px] shrink-0 mt-0.5">
        {priority && (
          <span className="text-[8px] font-bold px-[5px] py-px rounded-[3px] bg-[rgba(192,57,43,.1)] text-[#c0392b]">{priority}</span>
        )}
        {live && (
          <span className="text-[8px] font-bold px-[5px] py-px rounded-[3px] bg-[#1e7e45] text-white">Live</span>
        )}
      </div>
    </div>
  );
}
