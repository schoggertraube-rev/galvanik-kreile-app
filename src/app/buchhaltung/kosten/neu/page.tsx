import { KostenForm } from "./KostenForm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function NeuerKostenpostenPage() {
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
        <span className="text-navy-900">Neu</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#1e1b18] tracking-tight">Kostenposten anlegen</h1>
        <p className="text-sm font-semibold text-neutral-500 mt-2">Erfassen Sie einen neuen Fixkosten- oder variablen Posten.</p>
      </div>

      <KostenForm />
    </div>
  );
}
