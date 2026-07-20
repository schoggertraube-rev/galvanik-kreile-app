import { RechnungForm } from "./RechnungForm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { readInvoiceCreateCapability } from "@/lib/server/invoiceCreateCapability";

export default async function NeueRechnungPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const [{ order }, writeCapability] = await Promise.all([searchParams, readInvoiceCreateCapability()]);
  const initialOrderId = typeof order === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(order) ? order : "";
  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 min-h-screen">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung/rechnungen" className="hover:text-navy-900 transition-colors">Rechnungen</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Neu</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#1e1b18] tracking-tight">Rechnung anlegen</h1>
        <p className="text-sm font-semibold text-neutral-500 mt-2">Erstellen Sie eine neue Ausgangsrechnung.</p>
      </div>

      <RechnungForm initialOrderId={initialOrderId} writeCapability={writeCapability} />
    </div>
  );
}
