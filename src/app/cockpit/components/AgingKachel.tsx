"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Loader2 } from "lucide-react";
import { getAgingDaten } from "../actions";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

export function AgingKachel() {
  const [data, setData] = useState<AgingData[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  return (
    <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col h-[350px]">
      <div className="p-6 pb-2 flex items-center justify-between border-b border-neutral-gray-100">
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
                    formatter={(value: any, name: any, props: any) => [`€ ${Number(value).toLocaleString('de-DE')}`, `Summe (${props.payload.anzahl} Rechnungen)`]}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} onClick={(data: any) => router.push(`/buchhaltung/rechnungen?filter=${data?.payload?.bucketId || data?.bucketId}`)}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.bucketId] || '#9E9E9E'} />
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
  );
}
