"use client";

import { getSegmentById, updateSegment, deleteSegment } from "../actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";

export default function SegmentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [segment, setSegment] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getSegmentById(params.id).then(setSegment).catch(console.error);
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await updateSegment(params.id, formData);
      router.push("/marketing/segmente");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Fehler beim Aktualisieren");
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Segment wirklich löschen?")) return;
    setLoading(true);
    try {
      await deleteSegment(params.id);
      router.push("/marketing/segmente");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Fehler beim Löschen");
      setLoading(false);
    }
  }

  if (!segment) {
    return <div className="p-12 text-center text-slate-500">Lade...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/marketing/segmente" className="text-slate-500 hover:text-slate-800">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold">Segment bearbeiten</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-3 border border-red-200">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name (Pflichtfeld)</label>
            <input 
              type="text" 
              name="name" 
              required 
              defaultValue={segment.name}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Icon (Emoji)</label>
              <input 
                type="text" 
                name="icon" 
                defaultValue={segment.icon}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Farbe</label>
              <input 
                type="color" 
                name="farbe" 
                defaultValue={segment.farbe || "#e91e63"}
                className="w-full h-10 px-1 py-1 border border-slate-300 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Beschreibung</label>
            <textarea 
              name="beschreibung" 
              rows={4}
              defaultValue={segment.beschreibung}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button 
              type="button"
              onClick={handleDelete}
              disabled={loading || segment.isDemo === false}
              className="flex items-center gap-2 text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              <Trash2 size={20} />
              <span>Löschen</span>
            </button>
            <div className="flex gap-4">
              <Link href="/marketing/segmente" className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
                Abbrechen
              </Link>
              <button 
                type="submit" 
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={20} />
                <span>{loading ? "Speichert..." : "Änderungen speichern"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
