import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import { getSegments } from "./actions";
import Link from "next/link";
import { PlusCircle, Search, Edit2 } from "lucide-react";

export default async function SegmentePage({ searchParams }: { searchParams: { q?: string } }) {
  const query = searchParams.q || "";
  const segmente = await getSegments(query);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Marketing',href:'/marketing'}, {label:'Segmente'}]} />
        <BackButton label="Marketing" href="/marketing" />
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Kundensegmente</h1>
        <Link href="/marketing/segmente/neu" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <PlusCircle size={20} />
          <span>Neues Segment</span>
        </Link>
      </div>

      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <form className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
          <input 
            type="text" 
            name="q" 
            defaultValue={query}
            placeholder="Segmente filtern..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {segmente.map((s) => (
          <div key={s.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative">
            <div className="flex items-start gap-4">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: `${s.farbe}20`, color: s.farbe || undefined }}
              >
                {s.icon || '📌'}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{s.name}</h3>
                <p className="text-slate-500 text-sm line-clamp-2">{s.beschreibung || 'Keine Beschreibung'}</p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-between items-center border-t border-slate-100 pt-4">
              <div className="text-sm text-slate-500">
                {s.isDemo ? 'Demo-Daten' : 'Aktiv'}
              </div>
              <Link href={`/marketing/segmente/${s.id}`} className="text-blue-600 hover:text-blue-800 p-2 rounded-md hover:bg-blue-50">
                <Edit2 size={18} />
              </Link>
            </div>
          </div>
        ))}
        {segmente.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-lg border border-dashed border-slate-300">
            Keine Segmente gefunden.
          </div>
        )}
      </div>
    </div>
  );
}
