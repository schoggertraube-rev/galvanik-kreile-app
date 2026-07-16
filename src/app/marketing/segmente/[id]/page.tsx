"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import { getSegmentById, updateSegment, deleteSegment } from "../actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { use, useCallback, useState, useEffect } from "react";

export default function SegmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SegmentDetailPageContent key={id} id={id} />;
}

function SegmentDetailPageContent({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [segment, setSegment] = useState<Awaited<ReturnType<typeof getSegmentById>> | null>(null);
  const [error, setError] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not_found" | "error">("loading");
  const [loadError, setLoadError] = useState("");

  const loadSegment = useCallback(() => {
    return getSegmentById(id)
      .then((result) => {
        setSegment(result);
        setLoadError("");
        setLoadState(result ? "ready" : "not_found");
      })
      .catch((loadFailure: unknown) => {
        setSegment(null);
        setLoadError(loadFailure instanceof Error ? loadFailure.message : "Segment konnte nicht geladen werden.");
        setLoadState("error");
      });
  }, [id]);

  useEffect(() => { void loadSegment(); }, [loadSegment]);

  function retryLoad() {
    setLoadState("loading");
    setLoadError("");
    void loadSegment();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await updateSegment(id, formData);
      router.push("/marketing/segmente");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Fehler beim Aktualisieren");
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Segment wirklich löschen?")) return;
    setLoading(true);
    try {
      await deleteSegment(id);
      router.push("/marketing/segmente");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
      setLoading(false);
    }
  }

  if (loadState === "loading") {
    return <div role="status" className="p-12 text-center text-slate-500">Segment wird geladen …</div>;
  }
  if (loadState === "error") {
    return (
      <div role="alert" className="mx-auto mt-12 max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h1 className="font-bold">Segmentdaten nicht verfügbar</h1>
        <p className="mt-2 text-sm">{loadError}</p>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={retryLoad} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white"><RefreshCw className="h-4 w-4" /> Erneut laden</button>
          <Link href="/marketing/segmente" className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold">Zurück</Link>
        </div>
      </div>
    );
  }
  if (loadState === "not_found" || !segment) {
    return <div className="mx-auto mt-12 max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center"><h1 className="font-bold">Segment nicht gefunden</h1><Link href="/marketing/segmente" className="mt-4 inline-block text-sm font-bold text-blue-700 underline">Zur Segmentliste</Link></div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Marketing',href:'/marketing'}, {label:'Segmente',href:'/marketing/segmente'}, {label:'Detail'}]} />
        <BackButton label="Segmente" href="/marketing/segmente" />
      </div>
      
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
                defaultValue={segment.icon ?? ""}
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
              defaultValue={segment.beschreibung ?? ""}
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
