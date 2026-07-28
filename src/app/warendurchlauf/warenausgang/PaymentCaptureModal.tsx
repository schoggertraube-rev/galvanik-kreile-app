import { createFoundationUnavailableComponent } from "@/components/foundation/createFoundationUnavailableComponent";

export const PaymentCaptureModal = createFoundationUnavailableComponent({
  title: "Zahlungserfassung nicht freigegeben",
  reason: "Zahlungen dürfen ohne Finanz-, Rollen- und Auditvertrag nicht erfasst werden.",
});
