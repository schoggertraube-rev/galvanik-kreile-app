"use client";
// src/components/customers/CustomerTypeConsequences.tsx
// Zeigt eine ruhige Konsequenz-Zeile unterhalb der Kundentyp-Auswahl
import { getCustomerConsequences } from "@/lib/customerType/consequences";
import type { CustomerType } from "@/types/customerType";

interface Props {
  type: CustomerType | null | undefined;
}

export function CustomerTypeConsequences({ type }: Props) {
  if (!type) return null;

  const consequences = getCustomerConsequences(type);

  return (
    <p className="text-xs text-navy-500 bg-bg-app-soft border border-neutral-gray-100 rounded-xl px-3 py-2 mt-2 leading-relaxed">
      <span className="font-semibold text-navy-700">ℹ️ Konsequenzen:</span>{" "}
      {consequences.message}
      {consequences.requiresExtendedDocumentation && (
        <> Erweiterte Dokumentation empfohlen.</>
      )}
    </p>
  );
}
