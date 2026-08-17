import { BackButton } from "@/components/ui/BackButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

const NOT_AVAILABLE_MESSAGE = "NOT_AVAILABLE: Kunden-Detailansicht ben\u00f6tigt einen tenant- und ownership-gepr\u00fcften W3-Read-Vertrag.";

export default function CustomerProfilePage() {
  return (
    <div className="min-h-screen bg-bg-app-soft p-8">
      <div className="mb-6 space-y-3">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Customers", href: "/customers" }, { label: "[id]" }]} />
        <BackButton label="Customers" href="/customers" />
      </div>

      <main className="mx-auto max-w-2xl rounded-2xl border border-neutral-gray-300 bg-white p-8 shadow-xs">
        <h1 className="text-2xl font-bold text-navy-900">Kunden-Detailansicht nicht verfügbar</h1>
        <p className="mt-4 text-text-muted">{NOT_AVAILABLE_MESSAGE}</p>
      </main>
    </div>
  );
}
