// src/lib/privacy/dsgvoAnonymizer.ts
// DSGVO: Personenbezogene Daten anonymisieren, aber Rechnungs/Auftragsdaten behalten
import { customersRepository } from "@/lib/repositories/customersRepository";

export async function anonymizeCustomer(customerId: string, byUser: string): Promise<boolean> {
  const customer = (await customersRepository.getAll()).find(c => c.id === customerId);
  if (!customer) return false;

  const anonymizedData = {
    name: "ANONYMISIERT_" + customerId.substring(0, 6),
    email: "anonym@geloescht.local",
    phone: "+0000000000",
    street: "Anonymisiert 1",
    city: "00000 Anonym",
    notes: `Datensatz am ${new Date().toLocaleDateString("de-DE")} von ${byUser} gem. DSGVO anonymisiert.`,
  };

  await customersRepository.updateCustomer(customerId, anonymizedData);

  // Note: in a real system, we'd also anonymize unbilled order descriptions if they contain PII.
  return true;
}
