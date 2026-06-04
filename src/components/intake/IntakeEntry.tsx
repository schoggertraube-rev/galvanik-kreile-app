"use client";

import { useState, useEffect } from "react";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import {
  Clock,
  Info,
  Camera,
  Edit3,
  MessageSquare,
  ChevronRight,
  X,
  ChevronLeft,
  Phone
} from "lucide-react";
import Link from "next/link";


export function IntakeEntry({
  onSelect,
}: {
  onSelect: (mode: "camera" | "manual") => void;
}) {
  const [openQuotes, setOpenQuotes] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalSlide, setModalSlide] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const qCount = await inquiriesRepository.getOpenCount();
      setOpenQuotes(qCount);
      const oList = await ordersRepository.getAll();
      setTotalOrders(oList?.length ?? 0);
    };
    fetchStats();
    
    window.addEventListener("kreile-inquiries-updated", fetchStats);
    window.addEventListener("storage", fetchStats);
    return () => {
      window.removeEventListener("kreile-inquiries-updated", fetchStats);
      window.removeEventListener("storage", fetchStats);
    };
  }, []);

  const nextSlide = () => setModalSlide((s) => Math.min(2, s + 1));
  const prevSlide = () => setModalSlide((s) => Math.max(0, s - 1));

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-400">

      {/* ── SECTION HEADER ── */}
      <div className="relative pb-2 flex flex-col items-center">
        <h2 className="text-2xl font-black text-navy-900 tracking-tight text-center">Neue Annahme erfassen</h2>
        <div className="h-1 w-14 bg-gold-600 rounded-full mt-2" />
      </div>

      {/* ── TELEFONNOTIZ SHORTCUT ── */}
      <Link href="/telefonnotiz?returnTo=/warendurchlauf/wareneingang" className="flex items-center justify-between w-full bg-navy-900 rounded-3xl p-6 hover:bg-navy-800 transition-all shadow-md group cursor-pointer">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <Phone className="w-6 h-6 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xl font-black text-white leading-snug">Telefonnotiz anlegen</p>
            <p className="text-sm text-white/70 mt-0.5">Schnellerfassung starten</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-all duration-200">
          <ChevronRight className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
      </Link>

      {/* ── ACTION GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CAMERA CARD */}
        <button
          onClick={() => onSelect("camera")}
          className="bg-white rounded-3xl border border-neutral-gray-100 p-8 text-left flex items-center justify-between hover:shadow-md hover:border-accent-orange/20 transition-all duration-200 active:scale-98 group cursor-pointer"
        >
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-bg-app-soft flex items-center justify-center shrink-0 border border-neutral-gray-100">
              <Camera className="w-8 h-8 text-accent-orange" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xl font-black text-navy-900 leading-snug">Kamera</p>
              <p className="text-sm text-text-muted mt-0.5">Foto aufnehmen</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-neutral-gray-100 group-hover:bg-accent-orange transition-all duration-200">
            <ChevronRight className="w-5 h-5 text-accent-orange group-hover:text-white transition-colors" strokeWidth={2} />
          </div>
        </button>

        {/* MANUAL ENTRY CARD */}
        <button
          onClick={() => onSelect("manual")}
          className="bg-white rounded-3xl border border-neutral-gray-100 p-8 text-left flex items-center justify-between hover:shadow-md hover:border-accent-orange/20 transition-all duration-200 active:scale-98 group cursor-pointer"
        >
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-bg-app-soft flex items-center justify-center shrink-0 border border-neutral-gray-100">
              <Edit3 className="w-8 h-8 text-accent-orange" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xl font-black text-navy-900 leading-snug">Manuell anlegen</p>
              <p className="text-sm text-text-muted mt-0.5">Ohne Scan erfassen</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-neutral-gray-100 group-hover:bg-accent-orange transition-all duration-200">
            <ChevronRight className="w-5 h-5 text-accent-orange group-hover:text-white transition-colors" strokeWidth={2} />
          </div>
        </button>
      </div>

      {/* ── ANFRAGEN MINI CARD ── */}
      <div className="flex justify-center">
        <Link
          href="/quotes"
          className="flex items-center justify-between w-full md:w-[60%] bg-white rounded-3xl border border-neutral-gray-100 p-5 hover:shadow-md hover:border-accent-orange/20 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-bg-app-soft flex items-center justify-center shrink-0 border border-neutral-gray-100">
              <MessageSquare className="w-6 h-6 text-navy-700" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-navy-900 text-lg">Anfragen</span>
                {openQuotes > 0 && (
                  <span className="bg-danger-red text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">
                    {openQuotes}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">Offene Angebotsanfragen</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-neutral-gray-100 group-hover:bg-accent-orange transition-all duration-200">
            <ChevronRight className="w-5 h-5 text-accent-orange group-hover:text-white transition-colors" strokeWidth={2} />
          </div>
        </Link>
      </div>

      {/* ── LETZTE ANNAHMEN ── */}
      <div className="space-y-2">
        <Link
          href="/orders"
          className="flex items-center justify-between p-5 bg-white rounded-2xl border border-neutral-gray-100 hover:shadow-sm hover:border-accent-orange/10 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-bg-app-soft flex items-center justify-center shrink-0 border border-neutral-gray-100">
              <Clock className="w-5 h-5 text-accent-orange" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Letzte Annahmen anzeigen ({totalOrders} gesamt)
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-navy-900 transition-colors" />
        </Link>
      </div>

      {/* ── TIPP BANNER REMOVED ── */}

      {/* ── INSTRUCTIONS MODAL (3-STEP-SLIDER) ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-neutral-gray-100 w-full max-w-[480px] p-6 shadow-elevated animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-navy-900 text-2xl leading-none cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-navy-900 mb-4">So funktioniert der OCR-Scan</h3>

            {/* Slider slide container */}
            <div className="min-h-[140px] flex flex-col justify-center text-center px-4">
              {modalSlide === 0 && (
                <div className="space-y-2 animate-in fade-in duration-300">
                  <div className="w-14 h-14 bg-accent-orange-soft rounded-full flex items-center justify-center mx-auto mb-2">
                    <Camera className="w-7 h-7 text-accent-orange" />
                  </div>
                  <h4 className="font-extrabold text-navy-900 text-sm">Schritt 1: Lieferschein fotografieren</h4>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Fotografiere das Kundenbegleitschreiben oder den Lieferschein frontal ab. Achte auf gute Ausleuchtung.
                  </p>
                </div>
              )}
              {modalSlide === 1 && (
                <div className="space-y-2 animate-in fade-in duration-300">
                  <div className="w-14 h-14 bg-accent-orange-soft rounded-full flex items-center justify-center mx-auto mb-2">
                    <Info className="w-7 h-7 text-accent-orange" />
                  </div>
                  <h4 className="font-extrabold text-navy-900 text-sm">Schritt 2: Texterkennung abwarten</h4>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Unsere KI liest Kundennummer, Stückzahlen und Oberflächen automatisch aus. Unsichere Stellen werden hervorgehoben.
                  </p>
                </div>
              )}
              {modalSlide === 2 && (
                <div className="space-y-2 animate-in fade-in duration-300">
                  <div className="w-14 h-14 bg-success-green-soft rounded-full flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-7 h-7 text-success-green" />
                  </div>
                  <h4 className="font-extrabold text-navy-900 text-sm">Schritt 3: Bestätigen & Drucken</h4>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Vergleiche die erkannten Daten, wähle den Kunden aus, und drucke direkt die A6 Laufkarte mit QR-Code!
                  </p>
                </div>
              )}
            </div>

            {/* Slider Navigation controls */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-gray-100">
              <button
                disabled={modalSlide === 0}
                onClick={prevSlide}
                className="flex items-center gap-1.5 text-xs font-bold text-navy-700 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Zurück
              </button>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === modalSlide ? "bg-accent-orange w-4" : "bg-neutral-gray-300"
                    }`}
                  />
                ))}
              </div>
              {modalSlide < 2 ? (
                <button
                  onClick={nextSlide}
                  className="flex items-center gap-1.5 text-xs font-bold text-navy-700 cursor-pointer"
                >
                  Weiter <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-accent-orange text-white text-xs font-extrabold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-accent-orange/90"
                >
                  Alles verstanden!
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
