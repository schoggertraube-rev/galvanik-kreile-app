import { getKostenpostenAction } from "@/app/buchhaltung/actions";
import Link from "next/link";
import { ChevronRight, PieChart, TrendingUp } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

export default async function KostenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kosten = await getKostenpostenAction(id);

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 min-h-screen">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung/kosten" className="hover:text-navy-900 transition-colors">Kosten</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">{kosten.bezeichnung}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            {kosten.art === "fix" ? <PieChart className="w-7 h-7 text-blue-500" /> : <TrendingUp className="w-7 h-7 text-amber-500" />}
            <h1 className="text-3xl font-extrabold text-[#1e1b18] tracking-tight">{kosten.bezeichnung}</h1>
            <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wide uppercase border ${
              kosten.art === "fix" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
              {kosten.art === "fix" ? "Fix" : "Variabel"}
            </span>
          </div>
          <p className="text-sm font-semibold text-neutral-500 mt-2">
            Details zum Kostenposten
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100">
          <h3 className="text-sm font-bold text-[#1e1b18] mb-4">Details</h3>
          <div className="flex justify-between items-center text-sm mb-3">
            <span className="font-semibold text-neutral-500">Kategorie:</span>
            <span className="font-bold text-[#1e1b18]">{kosten.kategorie || "-"}</span>
          </div>
          <div className="flex justify-between items-center text-sm mb-3">
            <span className="font-semibold text-neutral-500">Intervall:</span>
            <span className="font-bold text-[#1e1b18] capitalize">{kosten.intervall}</span>
          </div>
          <div className="flex justify-between items-center text-sm mb-3">
            <span className="font-semibold text-neutral-500">Gilt Ab:</span>
            <span className="font-bold text-[#1e1b18]">{kosten.giltAb ? new Date(kosten.giltAb).toLocaleDateString("de-DE") : "-"}</span>
          </div>
          <div className="flex justify-between items-center text-sm mb-3">
            <span className="font-semibold text-neutral-500">Gilt Bis:</span>
            <span className="font-bold text-[#1e1b18]">{kosten.giltBis ? new Date(kosten.giltBis).toLocaleDateString("de-DE") : "-"}</span>
          </div>
          <div className="w-full h-px bg-neutral-200 my-4" />
          <div className="flex justify-between items-center text-lg">
            <span className="font-bold text-[#1e1b18]">Betrag:</span>
            <span className="font-extrabold text-[#1e1b18]">{kosten.betrag.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
          </div>
        </div>
      </div>

      <FeedbackFooter pageTitle={`Kostenposten ${kosten.bezeichnung}`} route={`/buchhaltung/kosten/${kosten.id}`} variant="full" />
    </div>
  );
}
