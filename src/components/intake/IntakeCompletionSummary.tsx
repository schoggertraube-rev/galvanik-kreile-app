"use client";

import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

type IntakeCompletionSummaryProps = {
  customerSelection: { id: string | null; newName?: string };
  newCustomerDetails?: Record<string, string>;
  items: Record<string, unknown>[];
  onBack?: () => void;
};

/**
 * Historical intake completed an order locally and immediately claimed success.
 * The canonical capture/order receipt contract is not available yet, so this
 * component must remain inert even if a legacy screen accidentally imports it.
 */
export function IntakeCompletionSummary({
  customerSelection: _customerSelection,
  newCustomerDetails: _newCustomerDetails,
  items: _items,
  onBack: _onBack,
}: IntakeCompletionSummaryProps) {
  return (
    <FoundationUnavailable
      title="Auftragserfassung ist noch nicht freigegeben"
      reason="Die frühere Abschlussansicht konnte einen lokalen Erfolg, Etiketten und Druck behaupten, ohne einen belegten Auftrags-, Mandanten- und Receipt-Vertrag. Deshalb werden keine Aufträge erzeugt oder als gespeichert dargestellt."
    />
  );
}
