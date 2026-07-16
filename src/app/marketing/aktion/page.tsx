"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import { useEffect, useState } from "react";
import { getAktionen, changeAktionStatus } from "./actions";
import Link from "next/link";
import { PlusCircle, Play, CheckCircle, Clock } from "lucide-react";

export default function AktionenPage() {
  type MarketingActionRow = Awaited<ReturnType<typeof getAktionen>>[number];
  const [aktionen, setAktionen] = useState<MarketingActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const data = await getAktionen();
      setAktionen(data);
      setError(null);
      setLoading(false);
    } catch {
      setError("Marketing-Aktionen konnten nicht geladen werden.");
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void getAktionen().then((data) => {
      if (!active) return;
      setAktionen(data);
      setError(null);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError("Marketing-Aktionen konnten nicht geladen werden.");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function approve(id: string) {
    try {
      const receipt = await changeAktionStatus(id, 'freigegeben');
      if (receipt.status !== 'freigegeben') throw new Error('MARKETING_ACTION_APPROVAL_NOT_CONFIRMED');
      await loadData();
    } catch {
      setError("Die Freigabe konnte nicht dauerhaft bestätigt werden.");
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Marketing',href:'/marketing'}, {label:'Aktion'}]} />
        <BackButton label="Marketing" href="/marketing" />
      </div>
      
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

      {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

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
                      {(row.status === 'vorschlag' || row.status === 'geplant' || row.status === 'fehler') && (
                        <button onClick={() => approve(row.id)} className="text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-md">
                          Freigeben
                        </button>
                      )}
                      {row.status === 'freigegeben' && (
                        <span className="text-xs text-slate-500">Ausführung nur über einen verknüpften Kanal mit Provider-Receipt</span>
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
