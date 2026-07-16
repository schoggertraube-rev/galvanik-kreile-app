import React from "react";
import { AlertCircle, FileText, Mail, Phone, PlusSquare } from "lucide-react";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";

type CustomerHeaderData = {
  id: string;
  name: string;
  classification?: string | null;
  createdAt?: string | Date | null;
  email?: string | null;
  phone?: string | null;
};

type CustomerHeaderCapabilities = {
  canViewPrices: boolean;
  canCreateOrders: boolean;
  canManageQa: boolean;
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "nicht hinterlegt";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "ungültig hinterlegt" : parsed.toLocaleDateString("de-DE");
}

export function CustomerHeader({
  customer,
  capabilities,
}: {
  customer: CustomerHeaderData;
  capabilities: CustomerHeaderCapabilities;
}) {
  const { openErfassung } = useErfassung();

  return (
    <div className="flex w-full flex-col justify-between gap-4 pr-12 md:flex-row md:items-center">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-[var(--ci-ink)]">{customer.name}</h2>
          {customer.classification && (
            <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">
              Klasse {customer.classification}
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--ci-ink-3)]">Kunde seit {formatDate(customer.createdAt)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {customer.email ? (
          <a href={`mailto:${customer.email}`} className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-gray-50">
            <Mail className="h-4 w-4 text-gray-500" /><span className="hidden sm:inline">E-Mail</span>
          </a>
        ) : (
          <button type="button" disabled title="Keine E-Mail-Adresse hinterlegt" className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold opacity-50">
            <Mail className="h-4 w-4" /><span className="hidden sm:inline">E-Mail fehlt</span>
          </button>
        )}
        {customer.phone ? (
          <a href={`tel:${customer.phone}`} className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-gray-50">
            <Phone className="h-4 w-4 text-gray-500" /><span className="hidden sm:inline">Anrufen</span>
          </a>
        ) : (
          <button type="button" disabled title="Keine Telefonnummer hinterlegt" className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold opacity-50">
            <Phone className="h-4 w-4" /><span className="hidden sm:inline">Telefon fehlt</span>
          </button>
        )}
        {capabilities.canCreateOrders && (
          <button
            type="button"
            onClick={() => openErfassung({ mode: "order", intent: "create_order", source: "customer", customerId: customer.id })}
            className="flex items-center gap-2 rounded-lg border border-[var(--ci-orange)] bg-[var(--ci-orange)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <PlusSquare className="h-4 w-4" /><span className="hidden sm:inline">Neuer Auftrag</span>
          </button>
        )}
        {capabilities.canViewPrices && (
          <button type="button" disabled title="Rechnungserstellung ist in diesem Overlay nicht angebunden" className="rounded-lg border border-gray-200 p-2 opacity-50">
            <FileText className="h-4 w-4" />
          </button>
        )}
        {capabilities.canManageQa && (
          <button type="button" disabled title="Reklamationserfassung ist in diesem Overlay nicht angebunden" className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 opacity-50">
            <AlertCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
