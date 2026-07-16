"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import { useEffect, useState } from "react";
import { getKanaele } from "./actions";
import { CheckCircle, XCircle, Settings, Mail, Camera, Globe, LayoutTemplate } from "lucide-react";

export default function KanaelePage() {
  type MarketingChannel = Awaited<ReturnType<typeof getKanaele>>[number];
  const [kanaele, setKanaele] = useState<MarketingChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getKanaele().then(data => {
      setKanaele(data);
      setLoading(false);
    }).catch(() => {
      setError("Kanalstatus konnte nicht geladen werden.");
      setLoading(false);
    });
  }, []);

  function renderIcon(typ: string) {
    switch(typ) {
      case 'email': return <Mail size={24} className="text-blue-500" />;
      case 'instagram': return <Camera size={24} className="text-pink-500" />;
      case 'google': return <Globe size={24} className="text-green-500" />;
      case 'web': return <LayoutTemplate size={24} className="text-slate-500" />;
      default: return <Settings size={24} />;
    }
  }

  if (loading) return <div className="p-12 text-center">Lade Kanäle...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Marketing',href:'/marketing'}, {label:'Kanaele'}]} />
        <BackButton label="Marketing" href="/marketing" />
      </div>
      
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Marketing-Kanäle</h1>
        <p className="text-slate-500">Verbinde KREILE mit deinen Plattformen, um Aktionen zu steuern.</p>
      </div>

      {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {kanaele.map((k) => (
          <div key={k.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {renderIcon(k.typ)}
                <h3 className="font-semibold text-lg">{k.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                {k.typ === 'instagram' && k.verbunden ? (
                  <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <CheckCircle size={14} /> Verbunden
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                    <XCircle size={14} /> Nicht verbunden
                  </span>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-500 mb-6 h-10">
              {k.typ === 'email' && "Versand von Newslettern und Feedback-Anfragen an Kunden."}
              {k.typ === 'instagram' && "Automatisiertes Posten von Vorher-Nachher Bildern."}
              {k.typ === 'google' && "Generierung von Google-Bewertungen nach Auftragsabschluss."}
              {k.typ === 'web' && "UTM-Tracking aus Formularen und Webseiten-Traffic."}
            </p>

            <div className="pt-4 border-t border-slate-100">
              {k.typ === 'email' && (
                <button 
                  disabled
                  className="w-full py-2 bg-slate-100 text-slate-400 rounded-lg text-sm font-medium cursor-not-allowed"
                >
                  Serverkonfiguration erforderlich
                </button>
              )}
              {k.typ === 'instagram' && (
                <a
                  href="/api/marketing/instagram/connect"
                  className="block w-full py-2 text-center bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium"
                >
                  {k.verbunden ? 'Instagram neu verknüpfen' : 'Instagram verknüpfen'}
                </a>
              )}
              {k.typ === 'google' && (
                <button disabled className="w-full py-2 bg-slate-100 text-slate-400 rounded-lg text-sm font-medium cursor-not-allowed">
                  Nicht angebunden
                </button>
              )}
              {k.typ === 'web' && (
                <button 
                  disabled
                  className="w-full py-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-sm font-medium"
                >
                  Tracking noch nicht angebunden
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
