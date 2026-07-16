"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import { useEffect, useState } from "react";
import { getEinwilligungen } from "./actions";
import { CheckCircle, XCircle, Search, Upload } from "lucide-react";

export default function EinwilligungenPage() {
  type ConsentRow = Awaited<ReturnType<typeof getEinwilligungen>>[number];
  const [data, setData] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEinwilligungen().then(res => {
      setData(res);
      setLoading(false);
    }).catch(() => {
      setError("Einwilligungen konnten nicht geladen werden.");
      setLoading(false);
    });
  }, []);

  const filtered = data.filter(d => 
    (d.kundeName || '').toLowerCase().includes(query.toLowerCase()) || 
    (d.kundeEmail || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Marketing',href:'/marketing'}, {label:'Einwilligungen'}]} />
        <BackButton label="Marketing" href="/marketing" />
      </div>
      
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Einwilligungen (Opt-Ins)</h1>
          <p className="text-slate-500">Protokoll aller Marketing-Einwilligungen nach DSGVO.</p>
        </div>
        <button 
          disabled
          title="Bulk-Import ist noch nicht angebunden."
          className="flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-slate-400"
        >
          <Upload size={20} />
          <span>Import nicht angebunden</span>
        </button>
      </div>

      {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nach Kunden oder E-Mail suchen..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm">
                <th className="p-4 font-medium">Kunde</th>
                <th className="p-4 font-medium">Kanal</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Quelle</th>
                <th className="p-4 font-medium">Datum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-medium text-slate-900">{row.kundeName || 'Unbekannt'}</div>
                    <div className="text-sm text-slate-500">{row.kundeEmail || 'Keine E-Mail'}</div>
                  </td>
                  <td className="p-4">
                    <span className="capitalize">{row.kanal}</span>
                  </td>
                  <td className="p-4">
                    {row.status === 'erteilt' ? (
                      <span className="inline-flex items-center gap-1 text-sm text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                        <CheckCircle size={14} /> Erteilt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm text-red-700 bg-red-50 px-2 py-1 rounded-full border border-red-200">
                        <XCircle size={14} /> Widerrufen
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    {row.quelle}
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {new Date(row.zeitpunkt).toLocaleDateString("de-DE", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Keine Einwilligungen gefunden.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Lade Daten...
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
