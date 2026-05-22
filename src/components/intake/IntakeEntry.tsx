"use client";
import { Camera, Edit3, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function IntakeEntry({
  onSelect,
}: {
  onSelect: (mode: "camera" | "manual") => void;
}) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Back link */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm px-3 py-2 rounded-xl hover:bg-slate-100 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Zum Leitstand
        </Link>
      </div>

      <div className="text-center space-y-2 mb-4">
        <h2 className="text-3xl font-black font-serif text-slate-900">
          Neue Annahme erfassen
        </h2>
        <p className="text-slate-500 font-medium">
          Wähle, wie du den Auftrag erfassen möchtest.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Button
          onClick={() => onSelect("camera")}
          className="h-56 flex flex-col items-center justify-center gap-4 bg-blue-900 text-white hover:bg-blue-800 rounded-3xl shadow-xl border-4 border-blue-950 active:scale-95 transition-all"
        >
          <Camera className="h-14 w-14 text-orange-400" />
          <div className="text-center">
            <span className="block text-3xl font-black tracking-tight">
              Kamera
            </span>
            <span className="block text-base text-blue-200 mt-1 font-bold">
              Auftragserfassung
            </span>
          </div>
        </Button>

        <Button
          onClick={() => onSelect("manual")}
          className="h-56 flex flex-col items-center justify-center gap-4 bg-white text-slate-800 hover:bg-slate-50 rounded-3xl shadow-sm border-4 border-slate-200 active:scale-95 transition-all"
        >
          <Edit3 className="h-16 w-16 text-slate-400" />
          <div className="text-center">
            <span className="block text-3xl font-black tracking-tight">
              Manuell
            </span>
            <span className="block text-base text-slate-500 mt-1 font-bold">
              Auftragserfassung
            </span>
          </div>
        </Button>
      </div>

      <div className="mt-4 pt-6 border-t border-slate-200 text-center">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-900 font-bold text-sm px-4 py-2 rounded-xl hover:bg-slate-100 transition-all"
        >
          Vergangene Annahmen &amp; ähnliche Aufträge anzeigen
        </Link>
      </div>
    </div>
  );
}
