"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Wand2 } from "lucide-react";
import { createAktion } from "../actions";
import { getKanaele } from "../../kanaele/actions";
import { getSegments } from "../../segmente/actions";

export default function NeueAktionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [kanaele, setKanaele] = useState<any[]>([]);
  const [segmente, setSegmente] = useState<any[]>([]);
  const [inhalt, setInhalt] = useState("");

  useEffect(() => {
    getKanaele().then(setKanaele);
    getSegments().then(setSegmente);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append("inhalt", inhalt);
    
    try {
      await createAktion(formData);
      router.push("/marketing/aktion");
    } catch (err) {
      console.error(err);
      alert("Fehler beim Erstellen der Aktion");
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/marketing/aktion" className="text-slate-500 hover:text-slate-800">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold">Neue Aktion planen</h1>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Titel (intern)</label>
            <input 
              type="text" 
              name="titel" 
              required 
              placeholder="z.B. Newsletter Juni 2026"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Aktionstyp</label>
              <select 
                name="typ" 
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="mail">E-Mail (Newsletter)</option>
                <option value="post">Social Media Post</option>
                <option value="review_request">Bewertungsanfrage</option>
                <option value="ad">Werbeanzeige</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kanal</label>
              <select 
                name="kanalId" 
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Kanal wählen --</option>
                {kanaele.map(k => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Zielgruppe (Segment)</label>
              <select 
                name="segmentId" 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Alle Kunden</option>
                {segmente.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-slate-700">Inhalt (Text / HTML)</label>
              <button 
                type="button" 
                disabled
                title="Für diesen Editor ist noch kein metered KI-Entwurf angebunden."
                className="text-sm flex items-center gap-1 text-slate-400 cursor-not-allowed"
              >
                <Wand2 size={16} /> KI-Entwurf nicht angebunden
              </button>
            </div>
            <textarea 
              rows={6}
              value={inhalt}
              onChange={(e) => setInhalt(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
              placeholder="Schreiben Sie hier den Text der E-Mail oder des Posts..."
            />
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
            <Link href="/marketing/aktion" className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
              Abbrechen
            </Link>
            <button 
              type="submit" 
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={20} />
              <span>Als Vorschlag speichern</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
