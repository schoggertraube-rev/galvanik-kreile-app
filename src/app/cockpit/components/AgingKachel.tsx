"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Loader2, ArrowRight, Bell, Phone, FileText, X } from "lucide-react";
import { getAgingDaten, getAgingRechnungen, savePhoneNote } from "../actions";
import { sendeZahlungserinnerung, sendeMahnung } from "@/app/actions/mahnung.actions";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Link from "next/link";
import { KachelInfo } from "@/components/ui/KachelInfo";
import { ResponsiveDetailDrawer } from "@/components/ui/ResponsiveDetailDrawer";

type AgingData = {
  aging_bucket: string;
  anzahl: number;
  summe: number;
};

const BUCKET_ORDER = ['nicht_faellig', '1-14', '15-30', '31-60', '61-90', '>90'];

const COLORS: Record<string, string> = {
  'nicht_faellig': '#4CAF50',
  '1-14': '#8BC34A',
  '15-30': '#FFC107',
  '31-60': '#FF9800',
  '61-90': '#F44336',
  '>90': '#D32F2F',
  'ohne_faelligkeit': '#9E9E9E'
};

const LABELS: Record<string, string> = {
  'nicht_faellig': 'Nicht fällig',
  'ohne_faelligkeit': 'Ohne Datum',
  '1-14': '1-14 Tage',
  '15-30': '15-30 Tage',
  '31-60': '31-60 Tage',
  '61-90': '61-90 Tage',
  '>90': '> 90 Tage'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRecordField(value: unknown, field: string): unknown {
  return isRecord(value) ? value[field] : undefined;
}

function getAgingBucket(dataPayload: unknown): string | null {
  if (!isRecord(dataPayload)) return null;
  const nestedBucket = getRecordField(dataPayload.payload, "bucketId");
  if (typeof nestedBucket === "string") return nestedBucket;
  const bucket = dataPayload.bucketId;
  return typeof bucket === "string" ? bucket : null;
}

export function AgingKachel() {
  const [data, setData] = useState<AgingData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [rechnungen, setRechnungen] = useState<any[]>([]);
  const [rechnungenLoading, setRechnungenLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<string, 'idle'|'loading'|'done'>>({});
  
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneNote, setPhoneNote] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneTargetRechnung, setPhoneTargetRechnung] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const result = await getAgingDaten();
      const filtered = result.filter(r => BUCKET_ORDER.includes(r.aging_bucket));
      filtered.sort((a, b) => BUCKET_ORDER.indexOf(a.aging_bucket) - BUCKET_ORDER.indexOf(b.aging_bucket));
      setData(filtered);
      setLoading(false);
    }
    load();
  }, []);

  const handleBarClick = async (dataPayload: unknown) => {
    const bucket = getAgingBucket(dataPayload);
    if (!bucket) return;
    
    setSelectedBucket(bucket);
    setDrawerOpen(true);
    setRechnungenLoading(true);
    
    const result = await getAgingRechnungen(bucket);
    setRechnungen(result);
    setRechnungenLoading(false);
  };

  const handleErinnerung = async (id: string) => {
    setActionStatus(prev => ({ ...prev, [id]: 'loading' }));
    try {
      const res = await sendeZahlungserinnerung(id);
      if (res.modus === 'manuell') {
        navigator.clipboard.writeText(res.text);
        alert(`Text in Zwischenablage kopiert. Kein Mail-Provider angebunden.\n\n${res.hinweis}`);
      }
      setActionStatus(prev => ({ ...prev, [id]: 'done' }));
      setTimeout(() => setActionStatus(prev => ({ ...prev, [id]: 'idle' })), 3000);
    } catch (e) {
      alert("Fehler: " + (e as Error).message);
      setActionStatus(prev => ({ ...prev, [id]: 'idle' }));
    }
  };

  const handleMahnung = async (id: string) => {
    setActionStatus(prev => ({ ...prev, [id]: 'loading' }));
    try {
      const res = await sendeMahnung(id);
      if (res.modus === 'manuell') {
        navigator.clipboard.writeText(res.text);
        alert(`Text in Zwischenablage kopiert. Kein Mail-Provider angebunden.\n\n${res.hinweis}`);
      }
      setActionStatus(prev => ({ ...prev, [id]: 'done' }));
      setRechnungen(prev => prev.map(r => r.invoice_id === id ? { ...r, mahnstufe: res.neueMahnstufe } : r));
      setTimeout(() => setActionStatus(prev => ({ ...prev, [id]: 'idle' })), 3000);
    } catch (e) {
      alert("Fehler: " + (e as Error).message);
      setActionStatus(prev => ({ ...prev, [id]: 'idle' }));
    }
  };

  const handlePhoneClick = (rechnung: any) => {
    setPhoneTargetRechnung(rechnung);
    setPhoneNote(`Zahlungserinnerung RE-${rechnung.rechnung_nummer}\n\n`);
    setPhoneModalOpen(true);
  };

  const handleSavePhoneNote = async () => {
    if (!phoneNote.trim()) return;
    setPhoneSaving(true);
    try {
      await savePhoneNote({
        customer_id: phoneTargetRechnung?.kunde_name, // fallback as we might not have customer_id directly here
        caller_name: phoneTargetRechnung?.kunde_name,
        raw_text: phoneNote,
        category: "Buchhaltung",
        urgency: "Normal"
      });
      setPhoneModalOpen(false);
      setPhoneTargetRechnung(null);
    } catch (e) {
      console.error(e);
    } finally {
      setPhoneSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col h-[350px] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
      </div>
    );
  }

  const totalSum = data.reduce((acc, curr) => acc + curr.summe, 0);
  const ueber30Tage = data
    .filter(r => ['31-60', '61-90', '>90'].includes(r.aging_bucket))
    .reduce((acc, curr) => acc + curr.anzahl, 0);

  const chartData = data.map(r => ({
    name: LABELS[r.aging_bucket] || r.aging_bucket,
    bucketId: r.aging_bucket,
    value: r.summe,
    anzahl: r.anzahl
  }));
  
  const selectedBucketData = chartData.find(c => c.bucketId === selectedBucket);

  return (
    <>
      <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col h-[350px] relative" id="aging-kachel">
        <div className="absolute top-4 right-4 z-10">
          <KachelInfo 
            wasZeigtDieKachel="Offene Rechnungen gruppiert nach Überfälligkeitsdauer"
            wasBedeutetDas="Posten über 30 Tage erfordern aktives Handeln. Über 60 Tage: Mahnverfahren einleiten."
            datenquelle="Aus Ausgangsrechnungen mit Fälligkeitsdatum"
          />
        </div>
        
        <div className="p-6 pb-2 flex items-center justify-between border-b border-neutral-gray-100 pr-14">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-navy-500" />
            <h3 className="font-bold text-navy-900 text-lg">Forderungen-Aging</h3>
          </div>
        </div>
        
        <div className="flex-1 p-6 flex flex-col">
          {totalSum === 0 ? (
            <div className="flex-1 flex items-center justify-center text-neutral-gray-500 font-medium">
              Keine offenen Forderungen
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 w-full cursor-pointer">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis tickFormatter={(val) => `€${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip 
                      formatter={(value, _name, props) => [`€ ${Number(value).toLocaleString('de-DE')}`, `Summe (${String(getRecordField(props.payload, "anzahl"))} Rechnungen)`]}
                      cursor={{ fill: 'transparent' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} onClick={handleBarClick}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.bucketId] || '#9E9E9E'} className="hover:opacity-80 transition-opacity" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {ueber30Tage > 0 && (
                <div className="mt-4 text-sm font-medium text-danger-red text-center">
                  {ueber30Tage} Rechnung{ueber30Tage > 1 ? 'en' : ''} über 30 Tage überfällig
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ResponsiveDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedBucketData ? `Überfällig ${selectedBucketData.name} (${selectedBucketData.anzahl} Rechnungen, € ${selectedBucketData.value.toLocaleString('de-DE', {maximumFractionDigits:0})})` : 'Rechnungen laden...'}
      >
        {rechnungenLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {rechnungen.length === 0 ? (
              <p className="text-text-muted">Keine Rechnungen in diesem Bereich.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {rechnungen.map((r) => (
                  <div key={r.invoice_id} className="p-4 border border-neutral-gray-200 rounded-xl hover:border-navy-300 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-navy-900">{r.rechnung_nummer}</h4>
                          <span className="text-navy-600 font-medium">{r.kunde_name}</span>
                        </div>
                        <div className="text-sm text-danger-red font-medium flex items-center gap-1 mt-1">
                          Überfällig seit {r.faellig_seit_tagen} Tagen
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="font-bold text-lg">€ {r.netto?.toLocaleString('de-DE', {maximumFractionDigits:0}) || 0}</span>
                        <Link href={`/buchhaltung/rechnungen`} className="text-xs text-navy-600 hover:underline flex items-center gap-1">
                          Zur Rechnung <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                    
                    <div className="bg-neutral-gray-50 p-2 rounded-lg text-xs text-text-muted mb-3 flex items-center gap-2">
                      <FileText className="w-3 h-3" /> Keine bisherige Kommunikation dokumentiert.
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => handleErinnerung(r.invoice_id)}
                        disabled={actionStatus[r.invoice_id] === 'loading'}
                        className={`px-3 py-1.5 font-semibold rounded-md transition-colors text-xs flex items-center gap-1 disabled:opacity-50 ${actionStatus[r.invoice_id] === 'done' ? 'bg-success-green text-white' : 'bg-navy-600 hover:bg-navy-700 text-white'}`}
                      >
                        <Bell className="w-3 h-3" /> {actionStatus[r.invoice_id] === 'done' ? 'Kopiert!' : 'Zahlungserinnerung'}
                      </button>
                      <button 
                        onClick={() => handlePhoneClick(r)}
                        className="px-3 py-1.5 bg-neutral-gray-100 hover:bg-neutral-gray-200 text-navy-700 font-semibold rounded-md transition-colors text-xs flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" /> Anrufen
                      </button>
                      <button 
                        onClick={() => handleMahnung(r.invoice_id)}
                        disabled={actionStatus[r.invoice_id] === 'loading'}
                        className={`px-3 py-1.5 font-semibold rounded-md transition-colors text-xs flex items-center gap-1 disabled:opacity-50 ${actionStatus[r.invoice_id] === 'done' ? 'bg-success-green text-white' : 'bg-danger-red/10 hover:bg-danger-red/20 text-danger-red'}`}
                      >
                        <Bell className="w-3 h-3" /> {actionStatus[r.invoice_id] === 'done' ? 'Kopiert!' : `Mahnung (Stufe ${(r.mahnstufe || 0) + 1})`}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ResponsiveDetailDrawer>

      {phoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-neutral-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-navy-900">Telefonnotiz erfassen</h3>
              <button onClick={() => setPhoneModalOpen(false)} className="text-neutral-gray-400 hover:text-navy-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Gesprächspartner
              </label>
              <input 
                type="text" 
                value={phoneTargetRechnung?.kunde_name || ""} 
                disabled 
                className="w-full border border-neutral-gray-300 rounded-lg p-2 text-sm bg-neutral-gray-50 mb-4" 
              />
              
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Notiz
              </label>
              <textarea
                value={phoneNote}
                onChange={e => setPhoneNote(e.target.value)}
                className="w-full border border-neutral-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-navy-500 outline-none h-32 resize-none"
                placeholder="Gesprächsnotiz hier eingeben..."
              />
              
              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => setPhoneModalOpen(false)}
                  className="flex-1 py-2 font-semibold text-navy-600 bg-neutral-gray-50 hover:bg-neutral-gray-100 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={handleSavePhoneNote}
                  disabled={phoneSaving || !phoneNote.trim()}
                  className="flex-1 py-2 font-bold text-white bg-navy-600 hover:bg-navy-700 rounded-lg transition-colors disabled:opacity-50 flex justify-center items-center"
                >
                  {phoneSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Speichern"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
