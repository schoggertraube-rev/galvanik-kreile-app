"use client";

import { createSegment } from "../actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useState } from "react";

export default function NeuesSegmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await createSegment(formData);
      router.push("/marketing/segmente");
    } catch (err) {
      console.error(err);
      alert("Fehler beim Erstellen des Segments");
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/marketing/segmente" className="text-slate-500 hover:text-slate-800">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold">Neues Segment anlegen</h1>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name (Pflichtfeld)</label>
            <input 
              type="text" 
              name="name" 
              required 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="z.B. Architekten"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Icon (Emoji)</label>
              <input 
                type="text" 
                name="icon" 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="🏛️"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Farbe</label>
              <input 
                type="color" 
                name="farbe" 
                defaultValue="#e91e63"
                className="w-full h-10 px-1 py-1 border border-slate-300 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Beschreibung</label>
            <textarea 
              name="beschreibung" 
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Beschreibung des Segments..."
            />
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
            <Link href="/marketing/segmente" className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
              Abbrechen
            </Link>
            <button 
              type="submit" 
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={20} />
              <span>{loading ? "Speichert..." : "Segment speichern"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
