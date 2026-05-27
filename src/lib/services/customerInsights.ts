import { Customer, CustomerInsight, CustomerMockOrder } from "../types/customer";
import { createId } from "@paralleldrive/cuid2";

export function generateCustomerInsights(customer: Customer): CustomerInsight[] {
  const insights: CustomerInsight[] = [];
  const now = new Date().toISOString();

  // 1. Documentation Hint based on Complaint Risk
  if (customer.complaintSummary?.riskLevel === "high" || customer.complaintSummary?.riskLevel === "medium") {
    insights.push({
      id: createId(),
      customerId: customer.id,
      type: "documentation_hint",
      title: "Dokumentationshinweis",
      description: "Vorher-Fotos und Erwartungsklärung vor Arbeitsbeginn dringend empfohlen. " + 
                   (customer.complaintSummary.totalComplaints > 0 ? `(Bisher ${customer.complaintSummary.totalComplaints} Reklamationen)` : ""),
      severity: customer.complaintSummary.riskLevel === "high" ? "critical" : "watch",
      createdAt: now
    });
  }

  // 2. Approval Hint based on typical approval time
  if (customer.approvalProfile?.usualApprovalTimeDays && customer.approvalProfile.usualApprovalTimeDays >= 7) {
    insights.push({
      id: createId(),
      customerId: customer.id,
      type: "approval_hint",
      title: "Freigabehinweis",
      description: `Freigaben dauern bei diesem Kunden meist länger (Ø ${customer.approvalProfile.usualApprovalTimeDays} Tage). Bei Terminaufträgen frühzeitig nachfassen.`,
      severity: "watch",
      createdAt: now
    });
  }

  // 3. Payment/Prepayment Hint
  if (customer.paymentProfile?.paymentBehavior === "slow" || customer.paymentProfile?.paymentBehavior === "prepayment_required") {
    insights.push({
      id: createId(),
      customerId: customer.id,
      type: "payment_hint",
      title: "Zahlungshinweis",
      description: customer.paymentProfile.paymentBehavior === "prepayment_required" 
        ? "Vorkasse oder Anzahlung erforderlich, bevor mit der Bearbeitung gestartet wird."
        : "Kunde zahlt oft spät. Mahnwesen im Auge behalten.",
      severity: customer.paymentProfile.paymentBehavior === "prepayment_required" ? "critical" : "watch",
      createdAt: now
    });
  }

  // 4. Similar/Recurring Order Check (mocked based on recurringItems)
  if (customer.recurringItems && customer.recurringItems.length > 0) {
    const item = customer.recurringItems[0];
    insights.push({
      id: createId(),
      customerId: customer.id,
      type: "similar_order_found",
      title: "Wiederkehrende Teile",
      description: `Kunde bringt häufig "${item.name}". Typische Oberfläche: ${item.usualSurface || "unbekannt"}. Ø Preis: ${item.averagePriceNet || "?"} €.`,
      severity: "info",
      relatedItemId: item.id,
      createdAt: now
    });
  }

  // 5. Price Reference found
  if (customer.priceMemory && customer.priceMemory.length > 0) {
    const priceRef = customer.priceMemory[0];
    insights.push({
      id: createId(),
      customerId: customer.id,
      type: "price_reference",
      title: "Preisreferenz vorhanden",
      description: `"${priceRef.title}" wurde zuletzt für ${priceRef.priceNet} € (Netto) abgerechnet. ${priceRef.reason ? `Grund: ${priceRef.reason}` : ""}`,
      severity: "positive",
      createdAt: now
    });
  }

  // 6. VIP/Opportunity Hint
  if (customer.customerStatus === "vip") {
    insights.push({
      id: createId(),
      customerId: customer.id,
      type: "opportunity_hint",
      title: "VIP Status",
      description: "Dieser Kunde hat höchste Priorität. Reklamationen sind absolut zu vermeiden.",
      severity: "positive",
      createdAt: now
    });
  }

  return insights;
}
