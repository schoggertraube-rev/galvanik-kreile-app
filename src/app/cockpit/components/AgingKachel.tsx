"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Loader2, ArrowRight, Bell, Phone, FileText } from "lucide-react";
import { getAgingDaten, getAgingRechnungen, type AgingData, type AgingInvoiceRow } from "../actions";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Link from "next/link";
import { KachelInfo } from "@/components/ui/KachelInfo";
import { ResponsiveDetailDrawer } from "@/components/ui/ResponsiveDetailDrawer";

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
  const [rechnungen, setRechnungen] = useState<AgingInvoiceRow[]>([]);
  const [rechnungenLoading, setRechnungenLoading] = useState(false);

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
                  <div key={r.id} className="p-4 border border-neutral-gray-200 rounded-xl hover:border-navy-300 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-navy-900">{r.rechnungsnummer}</h4>
                          <span className="text-navy-600 font-medium">{r.kunde_name}</span>
                        </div>
                        <div className="text-sm text-danger-red font-medium flex items-center gap-1 mt-1">
                          Überfällig seit {r.tage_ueberfaellig ?? 0} Tagen
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
                      <FileText className="w-3 h-3" /> Kommunikationsstatus nicht verfügbar.
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <button 
                        disabled
                        title="NOT_AVAILABLE — Mahnwesen bis W3 nicht verfügbar"
                        className="px-3 py-1.5 font-semibold rounded-md transition-colors text-xs flex items-center gap-1 disabled:opacity-50 bg-navy-600 text-white"
                      >
                        <Bell className="w-3 h-3" /> Zahlungserinnerung
                      </button>
                      <span className="self-center text-xs text-text-muted">NOT_AVAILABLE — Mahnwesen bis W3 nicht verfügbar</span>
                      <button 
                        disabled
                        title="NOT_AVAILABLE — Telefonnotizen bis W3 nicht verfügbar"
                        className="px-3 py-1.5 bg-neutral-gray-100 text-navy-700 font-semibold rounded-md transition-colors text-xs flex items-center gap-1 disabled:opacity-50"
                      >
                        <Phone className="w-3 h-3" /> Anrufen
                      </button>
                      <span className="self-center text-xs text-text-muted">NOT_AVAILABLE — Telefonnotizen bis W3 nicht verfügbar</span>
                      <button 
                        disabled
                        title="NOT_AVAILABLE — Mahnwesen bis W3 nicht verfügbar"
                        className="px-3 py-1.5 font-semibold rounded-md transition-colors text-xs flex items-center gap-1 disabled:opacity-50 bg-danger-red/10 text-danger-red"
                      >
                        <Bell className="w-3 h-3" /> Mahnung
                      </button>
                      <span className="self-center text-xs text-text-muted">NOT_AVAILABLE — Mahnwesen bis W3 nicht verfügbar</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ResponsiveDetailDrawer>
    </>
  );
}
