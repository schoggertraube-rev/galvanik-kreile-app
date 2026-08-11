import { BackButton } from "@/components/ui/BackButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

const denialMessage =
  "NOT_AVAILABLE: Auftragsdetailansicht benötigt einen tenant- und ownership-geprüften W3-Read-Vertrag.";

export default function OrderDetailPage() {
  return (
    <div className="min-h-screen bg-transparent p-4 md:p-8">
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Orders", href: "/orders" },
            { label: "Auftragsdetail" },
          ]}
        />
        <BackButton label="Orders" href="/orders" />
      </div>

      <section
        className="max-w-2xl rounded-3xl border-2 border-amber-300 bg-amber-50 p-6 shadow-sm md:p-8"
        aria-labelledby="order-detail-denial-title"
      >
        <h1
          id="order-detail-denial-title"
          className="font-serif text-2xl font-black text-amber-950"
        >
          Auftragsdetail nicht verfügbar
        </h1>
        <p className="mt-3 text-base font-semibold leading-relaxed text-amber-900">
          {denialMessage}
        </p>
      </section>
    </div>
  );
}
