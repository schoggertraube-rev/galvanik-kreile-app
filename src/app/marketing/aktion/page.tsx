"use client";

import { useEffect, useState } from "react";
import { getAktionen, changeAktionStatus } from "./actions";
import Link from "next/link";
import { PlusCircle, Search, Play, CheckCircle, Clock } from "lucide-react";

export default function AktionenPage() {
  const [aktionen, setAktionen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const data = await getAktionen();
      setAktionen(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function updateStatus(id: string, status: string) {
    await changeAktionStatus(id, status);
    loadData();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Aktionen</h1>
          <p className="text-slate-500 text-sm">Geplante Kampagnen, Posts und E-Mails.</p>
        </div>
        <Link href="/marketing/aktion/neu" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <PlusCircle size={20} />
          <span>Neue Aktion</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="p-4 font-medium">Titel</th>
                <th className="p-4 font-medium">Kanal</th>
                <th className="p-4 font-medium">Segment</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aktionen.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-medium text-slate-900">{row.titel}</div>
                    <div className="text-xs text-slate-500 capitalize">{row.typ}</div>
                  </td>
                  <td className="p-4 text-sm text-slate-700">{row.kanalName || '-'}</td>
                  <td className="p-4 text-sm text-slate-700">{row.segmentName || 'Alle'}</td>
                  <td className="p-4">
                    {row.status === 'vorschlag' && <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full"><Clock size={12}/> Vorschlag</span>}
                    {row.status === 'freigegeben' && <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full"><CheckCircle size={12}/> Freigegeben</span>}
                    {row.status === 'ausgefuehrt' && <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full"><Play size={12}/> Ausgeführt</span>}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {row.status === 'vorschlag' && (
                        <button onClick={() => updateStatus(row.id, 'freigegeben')} className="text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-md">
                          Freigeben
                        </button>
                      )}
                      {row.status === 'freigegeben' && (
                        <button onClick={() => updateStatus(row.id, 'ausgefuehrt')} className="text-sm bg-green-500 text-white hover:bg-green-600 px-3 py-1 rounded-md">
                          Ausführen
                        </button>
                      )}
                      {row.status === 'ausgefuehrt' && (
                        <span className="text-xs text-slate-400">Keine Aktion</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {aktionen.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Keine Aktionen vorhanden.
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
