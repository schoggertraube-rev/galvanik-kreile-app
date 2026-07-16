"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Wand2 } from "lucide-react";
import { createAktion } from "../actions";
import { getKanaele } from "../../kanaele/actions";
import { getSegments } from "../../segmente/actions";

export default function NeueAktionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [kanaele, setKanaele] = useState<Awaited<ReturnType<typeof getKanaele>>>([]);
  const [segmente, setSegmente] = useState<Awaited<ReturnType<typeof getSegments>>>([]);
  const [inhalt, setInhalt] = useState("");
  const [optionsState, setOptionsState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const createRequestId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getKanaele(), getSegments()])
      .then(([channelRows, segmentRows]) => {
        if (!active) return;
        setKanaele(channelRows);
        setSegmente(segmentRows);
        setOptionsState("ready");
      })
      .catch((loadError) => {
        console.error("Marketing options failed", loadError);
        if (!active) return;
        setOptionsState("error");
        setError("Kanäle und Segmente konnten nicht geladen werden; die Aktion wird nicht mit Ersatzwerten angelegt.");
      });
    return () => { active = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || optionsState !== "ready") return;
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("inhalt", inhalt);
    let clientRequestId = createRequestId.current;
    if (!clientRequestId) {
      clientRequestId = crypto.randomUUID();
      createRequestId.current = clientRequestId;
    }
    formData.set("clientRequestId", clientRequestId);
    
    try {
      const receipt = await createAktion(formData);
      if (receipt.id !== clientRequestId || receipt.status !== "vorschlag") {
        throw new Error("MARKETING_ACTION_CREATE_NOT_CONFIRMED");
      }
      createRequestId.current = null;
      router.push("/marketing/aktion");
    } catch (err) {
      console.error(err);
      setError("Die Marketing-Aktion konnte nicht dauerhaft bestätigt werden. Ein unveränderter Retry verwendet dieselbe Anfrage-ID.");
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
        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <form
          onSubmit={handleSubmit}
          onInput={() => {
            if (!loading) createRequestId.current = null;
          }}
          className="space-y-6"
        >
          <fieldset disabled={loading || optionsState !== "ready"} className="contents">
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
              disabled={loading || optionsState !== "ready"}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={20} />
              <span>{loading ? "Wird bestätigt …" : optionsState === "loading" ? "Optionen werden geladen …" : "Als Vorschlag speichern"}</span>
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
