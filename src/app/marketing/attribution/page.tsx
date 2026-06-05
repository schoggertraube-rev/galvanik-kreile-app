"use client";

import { useEffect, useState } from "react";
import { getAttributionData } from "./actions";
import { Activity, ArrowUpRight, TrendingUp, DollarSign } from "lucide-react";

export default function AttributionPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAttributionData().then(res => {
      setData(res);
      setLoading(false);
    });
  }, []);

  const totalLeads = data.reduce((acc, row) => acc + row.leads, 0);
  const totalAuftraege = data.reduce((acc, row) => acc + row.auftraege, 0);
  const totalUmsatz = data.reduce((acc, row) => acc + row.umsatz, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Attribution & ROI</h1>
        <p className="text-slate-500">Live-Auswertung: Touchpoint ➔ Lead ➔ Auftrag ➔ Umsatz</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Activity size={20} />
            <h3 className="font-medium">Total Leads</h3>
          </div>
          <div className="text-3xl font-bold">{loading ? '-' : totalLeads}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <TrendingUp size={20} />
            <h3 className="font-medium">Konvertierte Aufträge</h3>
          </div>
          <div className="text-3xl font-bold">{loading ? '-' : totalAuftraege}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <DollarSign size={20} />
            <h3 className="font-medium">Zugeordneter Umsatz</h3>
          </div>
          <div className="text-3xl font-bold text-green-600">{loading ? '-' : `${totalUmsatz.toLocaleString('de-DE')} €`}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="p-4 font-medium">Kanal</th>
                <th className="p-4 font-medium">Ausgaben (Mtl.)</th>
                <th className="p-4 font-medium">Leads</th>
                <th className="p-4 font-medium">Aufträge</th>
                <th className="p-4 font-medium">Umsatz</th>
                <th className="p-4 font-medium">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-900 capitalize">{row.kanal}</td>
                  <td className="p-4 text-slate-600">{row.ausgaben} €</td>
                  <td className="p-4 font-semibold text-blue-600">{row.leads}</td>
                  <td className="p-4 font-semibold text-indigo-600">{row.auftraege}</td>
                  <td className="p-4 font-semibold text-green-600">{row.umsatz.toLocaleString('de-DE')} €</td>
                  <td className="p-4">
                    {row.roi > 0 ? (
                      <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-sm font-medium">
                        <ArrowUpRight size={16} /> {row.roi.toFixed(1)}%
                      </span>
                    ) : row.roi < 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-sm font-medium">
                        {row.roi.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">n/a</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Keine Attributionsdaten vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
