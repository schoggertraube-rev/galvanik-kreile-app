"use client";

import { useEffect, useState } from "react";
import { getKanaele, updateKanalConfig } from "./actions";
import { CheckCircle, XCircle, Settings, Mail, Instagram, Globe, LayoutTemplate } from "lucide-react";

export default function KanaelePage() {
  const [kanaele, setKanaele] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getKanaele().then(data => {
      setKanaele(data);
      setLoading(false);
    }).catch(console.error);
  }, []);

  async function connectEmail(id: string) {
    const key = prompt("Bitte API-Key für den E-Mail Provider (Brevo/Resend) eingeben:");
    if (!key) return;
    
    // Test-Mail senden (mocked for now, real implementation later)
    alert("Test-Mail wurde simuliert. API-Key wird gespeichert.");
    await updateKanalConfig(id, true, { provider: 'resend', key_prefix: key.substring(0, 4) + '...' });
    const data = await getKanaele();
    setKanaele(data);
  }

  function renderIcon(typ: string) {
    switch(typ) {
      case 'email': return <Mail size={24} className="text-blue-500" />;
      case 'instagram': return <Instagram size={24} className="text-pink-500" />;
      case 'google': return <Globe size={24} className="text-green-500" />;
      case 'web': return <LayoutTemplate size={24} className="text-slate-500" />;
      default: return <Settings size={24} />;
    }
  }

  if (loading) return <div className="p-12 text-center">Lade Kanäle...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Marketing-Kanäle</h1>
        <p className="text-slate-500">Verbinde KREILE mit deinen Plattformen, um Aktionen zu steuern.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {kanaele.map((k) => (
          <div key={k.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {renderIcon(k.typ)}
                <h3 className="font-semibold text-lg">{k.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                {k.verbunden ? (
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
              {k.typ === 'email' && !k.verbunden && (
                <button 
                  onClick={() => connectEmail(k.id)}
                  className="w-full py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium"
                >
                  Provider konfigurieren
                </button>
              )}
              {k.typ === 'email' && k.verbunden && (
                <button 
                  onClick={() => connectEmail(k.id)}
                  className="w-full py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium"
                >
                  Einstellungen ändern
                </button>
              )}
              {(k.typ === 'instagram' || k.typ === 'google') && (
                <button 
                  disabled
                  className="w-full py-2 bg-slate-100 text-slate-400 rounded-lg text-sm font-medium cursor-not-allowed"
                >
                  In Vorbereitung (Stufe 2)
                </button>
              )}
              {k.typ === 'web' && (
                <button 
                  disabled
                  className="w-full py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium"
                >
                  Aktiv (Tracking läuft)
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
