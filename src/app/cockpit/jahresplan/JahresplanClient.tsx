"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAktiverJahresplan, speichereJahresplan } from "../actions";
import { Lock, Save, ArrowLeft, CheckCircle } from "lucide-react";

const monateList = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

export function JahresplanClient({ isDevOrAdmin }: { isDevOrAdmin: boolean }) {
  const router = useRouter();
  const [jahr, setJahr] = useState<number>(new Date().getFullYear());
  const [monate, setMonate] = useState<Record<string, number>>(
    Object.fromEntries(monateList.map((_, i) => [String(i + 1), 0]))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadPlan() {
      setLoading(true);
      const plan = await getAktiverJahresplan(jahr);
      if (plan && plan.werte && plan.werte.monate) {
        setMonate(plan.werte.monate);
      } else {
        setMonate(Object.fromEntries(monateList.map((_, i) => [String(i + 1), 0])));
      }
      setLoading(false);
    }
    loadPlan();
  }, [jahr]);

  if (!isDevOrAdmin) {
    return (
      <div className="flex flex-col min-h-screen">
        <PageHeader title="Jahresplan" subtitle="Zielvorgaben" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 border border-neutral-gray-200 text-center shadow-sm">
            <Lock className="w-12 h-12 text-error-red mx-auto mb-4" />
            <h2 className="text-xl font-bold text-navy-900 mb-2">Kein Zugriff</h2>
            <p className="text-text-muted mb-4">Nur für Betriebsinhaber verfügbar.</p>
            <Link href="/cockpit" className="text-navy-600 font-bold hover:underline">
              Zurück zum Cockpit
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      await speichereJahresplan(jahr, monate);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } catch (err) {
      alert("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (m: string, val: string) => {
    const num = parseInt(val, 10);
    setMonate(prev => ({ ...prev, [m]: isNaN(num) ? 0 : num }));
  };

  const gesamt = Object.values(monate).reduce((acc, curr) => acc + (curr || 0), 0);

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="px-6 mt-4">
        <Link href="/cockpit" className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-navy-900">
          <ArrowLeft className="w-4 h-4" /> Zurück zum Cockpit
        </Link>
      </div>

      <PageHeader 
        title="Jahresplan-Eingabe" 
        subtitle="Umsatzziele in Euro pro Monat festlegen"
      />

      <div className="flex-1 p-6 max-w-4xl w-full mx-auto">
        <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm p-6 md:p-8">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-xl font-bold text-navy-900">Umsatzziele planen</h2>
              <p className="text-sm text-text-muted">Geben Sie die erwarteten Werte für jeden Monat ein.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-navy-900">Jahr:</label>
              <select 
                value={jahr} 
                onChange={(e) => setJahr(Number(e.target.value))}
                className="border border-neutral-gray-300 rounded-lg px-4 py-2 font-bold focus:ring-1 focus:ring-navy-900 outline-none"
              >
                {[jahr - 1, jahr, jahr + 1, jahr + 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-text-muted font-bold">Lade Plan...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                {monateList.map((mName, i) => {
                  const mKey = String(i + 1);
                  return (
                    <div key={mKey} className="flex flex-col">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">{mName}</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={monate[mKey] || ""}
                          onChange={(e) => handleValueChange(mKey, e.target.value)}
                          className="w-full border border-neutral-gray-300 rounded-xl pl-4 pr-10 py-3 font-bold text-navy-900 focus:border-navy-900 focus:ring-1 focus:ring-navy-900 outline-none transition-all"
                          placeholder="0"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-bold">€</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-neutral-gray-200 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-lg">
                  <span className="text-text-muted">Jahresgesamt: </span>
                  <span className="font-bold text-navy-900 text-2xl">{gesamt.toLocaleString('de-DE')} €</span>
                </div>
                
                <div className="flex items-center gap-4">
                  {success && (
                    <span className="flex items-center gap-2 text-success-green font-bold text-sm">
                      <CheckCircle className="w-4 h-4" /> Jahresplan für {jahr} gespeichert
                    </span>
                  )}
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-navy-900 hover:bg-navy-800 text-white font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" /> {saving ? "Speichert..." : "Speichern"}
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
