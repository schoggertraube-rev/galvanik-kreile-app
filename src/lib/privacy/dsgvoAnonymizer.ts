/**
 * A destructive privacy operation needs a verified tenant, role, legal basis,
 * audit receipt and a product-approved retention policy. None of those
 * contracts is live yet, so this former client-side repository mutation is
 * deliberately unavailable instead of pretending to anonymize a customer.
 */
export async function anonymizeCustomer(customerId: string, byUser: string): Promise<never> {
  void customerId;
  void byUser;
  throw new Error("NOT_CONFIGURED: DSGVO-Anonymisierung ist noch nicht als geprüfter Serverprozess freigegeben.");
}
