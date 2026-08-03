"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { VorlageResult } from "./VorschlagBanner";
import { ZeitSlider } from "./ZeitSlider";
import { MengenStepper } from "./MengenStepper";
import { BestaetigenButton } from "./BestaetigenButton";
import { getWahrscheinlicheArtikel } from "@/app/actions/vorlage.actions";
import { erfasseZeitDirekt, erfasseVerbrauch } from "@/app/actions/erfassung.actions";
import { getKostensatz } from "@/lib/erfassung/snapshot";
import { createClient } from "@/utils/supabase/client";

interface ErfassungSheetProps {
  orderId: string;
  stationKuerzel?: string;
  mode: 'zeit' | 'material' | 'beides';
  vorlage?: VorlageResult;
  onSuccess: () => void;
  onClose: () => void;
}

export function ErfassungSheet({
  orderId,
  stationKuerzel = 'SCH',
  mode,
  vorlage,
  onSuccess,
  onClose
}: ErfassungSheetProps) {
  const [activeTab, setActiveTab] = useState<'zeit' | 'material'>(mode === 'material' ? 'material' : 'zeit');
  const [minutes, setMinutes] = useState(45);
  const [kostensatz, setKostensatz] = useState<number | null>(null);
  const [employeeId, setEmployeeId] = useState<string>('');
  
  // Material state
  const [artikelListe, setArtikelListe] = useState<any[]>([]);
  const [mengen, setMengen] = useState<Record<string, number>>({});
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Initial data load
    async function init() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setEmployeeId(userData.user.id);

      const ksResult = await getKostensatz(supabase, userData.user.id, stationKuerzel, 'galvanik-kreile');
      if (ksResult.kostensatz !== null) {
        setKostensatz(ksResult.kostensatz);
      }

      // Load artikel suggestions
      const artikel = await getWahrscheinlicheArtikel(orderId);
      setArtikelListe(artikel);

      // Pre-fill time if template exists
      if (vorlage?.zeit) {
        const vZeit = vorlage.zeit.find(z => z.station === stationKuerzel);
        if (vZeit) setMinutes(vZeit.median_min);
      }
    }
    init();
  }, [orderId, stationKuerzel, vorlage]);

  const vorschlagMin = vorlage?.zeit?.find(z => z.station === stationKuerzel)?.median_min;

  const handleMengeChange = (id: string, val: number) => {
    setMengen(prev => ({ ...prev, [id]: val }));
  };

  const aufnehmen = (id: string) => {
    // Look up median from vorlage
    const vVerbrauch = vorlage?.verbrauch?.find(v => v.artikel_id === id);
    const m = vVerbrauch?.median_menge || 1;
    handleMengeChange(id, m);
  };

  const handleSaveZeit = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await erfasseZeitDirekt({
      auftrag_id: orderId,
      employee_id: employeeId,
      station_kuerzel: stationKuerzel,
      dauer_minuten: minutes
    });
    setLoading(false);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      onSuccess();
    }
  };

  const handleSaveMaterial = async () => {
    setLoading(true);
    setErrorMsg(null);
    let hasError = false;
    for (const [id, menge] of Object.entries(mengen)) {
      if (menge <= 0) continue;
      const res = await erfasseVerbrauch({
        auftrag_id: orderId,
        employee_id: employeeId,
        station_kuerzel: stationKuerzel,
        inventory_item_id: id,
        menge
      });
      if (res.error) {
        setErrorMsg(res.error);
        hasError = true;
        break;
      }
    }
    setLoading(false);
    if (!hasError) {
      onSuccess();
    }
  };

  const kostenZeit = kostensatz ? (minutes / 60) * kostensatz : 0;
  // Approximation for total material cost - normally we'd fetch prices, but for UI mockup we assume 0 or dummy
  const kostenMaterial = 0; // The actual calculation requires price per item

  return (
    <div className="fixed inset-0 bg-black/50 flex flex-col justify-end z-50 animate-in fade-in duration-200 md:items-end md:justify-start">
      <div className="w-full md:max-w-[480px] bg-white h-[80vh] md:h-full rounded-t-3xl md:rounded-none shadow-2xl flex flex-col animate-in slide-in-from-bottom-full md:slide-in-from-right-full duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-neutral-gray-100 shrink-0">
          <div>
            <h2 className="text-2xl font-black font-serif text-navy-900">Erfassung</h2>
            <p className="text-text-muted text-xs font-bold mt-1">Station: {stationKuerzel}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-neutral-gray-100 hover:bg-neutral-gray-200 rounded-full transition-colors cursor-pointer"><X className="w-5 h-5 text-navy-900" /></button>
        </div>

        {/* Tabs */}
        {mode === 'beides' && (
          <div className="flex px-6 pt-4 shrink-0 border-b border-neutral-gray-100">
            <button 
              className={`flex-1 pb-3 text-sm font-bold border-b-4 transition-colors ${activeTab === 'zeit' ? 'border-[#C2185B] text-[#C2185B]' : 'border-transparent text-text-muted hover:text-navy-900'}`}
              onClick={() => setActiveTab('zeit')}
            >
              Zeit
            </button>
            <button 
              className={`flex-1 pb-3 text-sm font-bold border-b-4 transition-colors ${activeTab === 'material' ? 'border-[#C2185B] text-[#C2185B]' : 'border-transparent text-text-muted hover:text-navy-900'}`}
              onClick={() => setActiveTab('material')}
            >
              Material
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="bg-danger-red/10 border-l-4 border-danger-red text-danger-red p-4 mb-6 text-sm font-bold rounded-r-xl">
              {errorMsg}
            </div>
          )}

          {activeTab === 'zeit' ? (
            <div className="space-y-8 mt-4">
              <div className="flex gap-2 justify-center mb-8">
                {[15, 30, 45, 60, 90, 120].map(m => (
                  <Button 
                    key={m} 
                    variant="outline" 
                    className="flex-1 border-2 border-neutral-gray-200 rounded-xl h-12 font-bold text-navy-900 hover:border-[#C2185B] hover:text-[#C2185B]"
                    onClick={() => setMinutes(m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>

              <ZeitSlider 
                value={minutes} 
                onChange={setMinutes} 
                vorschlagWert={vorschlagMin}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {artikelListe.length === 0 ? (
                <div className="text-center py-8 text-text-muted font-bold text-sm bg-neutral-gray-50 rounded-2xl border-2 border-dashed border-neutral-gray-200">
                  Noch keine Artikel im Katalog — <a href="/settings" className="underline text-blue-600">Artikel anlegen</a>
                </div>
              ) : (
                artikelListe.map(item => {
                  const m = mengen[item.id] || 0;
                  return (
                    <div key={item.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-colors ${m > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-neutral-gray-200'}`}>
                      <div className="flex-1">
                        <div className="font-bold text-navy-900">{item.name}</div>
                        {item.haeufigkeit && (
                          <div className="text-xs font-semibold text-text-muted mt-1">Häufigkeit: {item.haeufigkeit}%</div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center ml-4">
                        {m > 0 ? (
                          <MengenStepper value={m} onChange={(val) => handleMengeChange(item.id, val)} einheit={item.einheit} />
                        ) : (
                          <Button 
                            variant="outline" 
                            className="border-2 border-neutral-gray-200 text-navy-900 font-bold hover:border-[#C2185B] hover:text-[#C2185B] h-12 rounded-xl px-6"
                            onClick={() => aufnehmen(item.id)}
                          >
                            + aufnehmen
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-gray-100 bg-white shrink-0">
          {activeTab === 'zeit' ? (
            <BestaetigenButton 
              label="Bestätigen"
              euroBetrag={kostenZeit}
              dauerMinuten={minutes}
              loading={loading}
              disabled={kostensatz === null}
              disabledHinweis="Kostensatz fehlt"
              onClick={handleSaveZeit}
            />
          ) : (
            <BestaetigenButton 
              label="Buchen & Speichern"
              euroBetrag={kostenMaterial}
              loading={loading}
              disabled={Object.values(mengen).reduce((a,b)=>a+b, 0) === 0}
              onClick={handleSaveMaterial}
            />
          )}
        </div>
      </div>
    </div>
  );
}
