"use client";

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import {
  getAktiveWarnungen,
  type ActiveWarning,
} from "../actions";
import Link from "next/link";
import { KachelInfo } from "@/components/ui/KachelInfo";

export function FruehwarnungenKachel() {
  const [warnungen, setWarnungen] = useState<ActiveWarning[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void getAktiveWarnungen()
      .then(data => {
        setWarnungen(data);
        setLoading(false);
      });
  }, []);

  if (loading && warnungen.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col max-h-[500px] relative">
        <div className="absolute top-4 right-4 z-10">
          <KachelInfo 
            wasZeigtDieKachel="Automatisch erkannte Risiken und Handlungsbedarf"
            wasBedeutetDas="Gelb = beobachten. Rot = sofort handeln. Jede Warnung können Sie mit Begründung quittieren."
            datenquelle="Berechnet aus Forderungen, Auslastung, Kundenaktivität und DB"
          />
        </div>

        <div className="p-6 pb-4 flex items-center justify-between border-b border-neutral-gray-100 pr-14">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-accent-orange" />
            <h3 className="font-bold text-navy-900 text-lg">Frühwarnungen (KI)</h3>
          </div>
          <button 
            disabled
            title="NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt."
            className="text-xs font-semibold text-navy-500 opacity-50"
          >
            Aktualisieren (NOT_AVAILABLE)
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {warnungen.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-emerald-600 gap-2 min-h-[200px]">
              <CheckCircle2 className="w-10 h-10" />
              <span className="font-semibold">Keine aktiven Warnungen</span>
            </div>
          ) : (
            warnungen.map(w => (
              <WarnungCard 
                key={w.id} 
                warnung={w} 
              />
            ))
          )}
        </div>
      </div>

    </>
  );
}

function WarnungCard({ warnung }: { warnung: ActiveWarning }) {
  let bgColor = 'bg-blue-50 border-blue-200';
  let dotColor = 'bg-blue-500';
  
  if (warnung.schwere === 'warnung') {
    bgColor = 'bg-amber-50 border-amber-200';
    dotColor = 'bg-amber-500';
  } else if (warnung.schwere === 'kritisch') {
    bgColor = 'bg-danger-red/10 border-danger-red/30';
    dotColor = 'bg-danger-red';
  }

  return (
    <div className={`p-4 rounded-xl border flex flex-col gap-2 ${bgColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${dotColor} shrink-0`} />
          <h4 className="font-bold text-navy-900 text-sm">{warnung.titel}</h4>
        </div>
        <span className="text-xs text-neutral-gray-500 whitespace-nowrap">
          {new Date(warnung.erzeugt_am ?? 0).toLocaleDateString('de-DE')}
        </span>
      </div>
      
      <p className="text-sm text-neutral-gray-700 ml-5">{warnung.beschreibung}</p>

      <div className="ml-5 mt-1 bg-white/50 rounded p-2 text-xs font-medium text-navy-800">
        💡 {warnung.typ === 'liquiditaet' && "Verschicken Sie Zahlungserinnerungen"}
        {warnung.typ.startsWith('auslastung') && "Prüfen Sie ob Sie Personal brauchen"}
        {warnung.typ === 'abwanderung' && "Kontaktieren Sie inaktive Kunden"}
        {warnung.typ.startsWith('db_negativ') && "Prüfen Sie die Kostenursache"}
      </div>
      
      <div className="flex items-center gap-3 mt-2 ml-5 flex-wrap">
        {warnung.typ === 'liquiditaet' && (
          <button onClick={() => {
            const el = document.getElementById("aging-kachel");
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }} className="text-xs font-semibold text-navy-600 hover:underline flex items-center gap-1 bg-white px-3 py-1.5 rounded-md border border-neutral-gray-200 shadow-sm">
            Überfällige Rechnungen anzeigen <ArrowRight className="w-3 h-3" />
          </button>
        )}
        {warnung.typ.startsWith('auslastung') && (
          <button onClick={() => {
            const el = document.getElementById("whatif-studio-btn");
            if (el) el.click();
          }} className="text-xs font-semibold text-navy-600 hover:underline flex items-center gap-1 bg-white px-3 py-1.5 rounded-md border border-neutral-gray-200 shadow-sm">
            Mitarbeiter-Szenario öffnen <ArrowRight className="w-3 h-3" />
          </button>
        )}
        {warnung.typ === 'abwanderung' && (
          <>
            <Link href="/customers" className="text-xs font-semibold text-navy-600 hover:underline flex items-center gap-1 bg-white px-3 py-1.5 rounded-md border border-neutral-gray-200 shadow-sm">
              Kunden anzeigen <ArrowRight className="w-3 h-3" />
            </Link>
          </>
        )}
        {warnung.typ.startsWith('db_negativ') && warnung.link && (
          <Link 
            href={warnung.link}
            className="text-xs font-semibold text-navy-600 hover:underline flex items-center gap-1 bg-white px-3 py-1.5 rounded-md border border-neutral-gray-200 shadow-sm"
          >
            Auftrag analysieren <ArrowRight className="w-3 h-3" />
          </Link>
        )}
        
        <button 
          disabled
          title="NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt."
          className="text-xs font-semibold text-neutral-gray-600 opacity-50 px-3 py-1.5 ml-auto"
        >
          Verstanden (NOT_AVAILABLE)
        </button>
      </div>
    </div>
  );
}
