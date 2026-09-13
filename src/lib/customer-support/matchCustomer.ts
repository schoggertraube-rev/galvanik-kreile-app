import { Customer, customersRepository } from "@/lib/repositories/customersRepository";

export async function matchCustomer(ocrText: string): Promise<Customer[]> {
  const allCustomers = await customersRepository.getAll();
  const lowerText = ocrText.toLowerCase();

  // Simple heuristic: extract potential name parts or phone numbers
  const potentialPhones = ocrText.match(/(?:\+49|0)[1-9][0-9\-\s]{5,}/g) || [];
  const phonesClean = potentialPhones.map(p => p.replace(/[\s\-]/g, ''));

  // We score customers based on matches
  const scoredMatches: { customer: Customer; score: number }[] = [];

  for (const customer of allCustomers) {
    let score = 0;

    // Check exact or partial name match
    if (customer.name && lowerText.includes(customer.name.toLowerCase())) {
      score += 50;
    }

    if (customer.companyName && lowerText.includes(customer.companyName.toLowerCase())) {
      score += 40;
    }

    // Check phone match
    if (customer.phone) {
      const custPhoneClean = customer.phone.replace(/[\s\-]/g, '');
      if (phonesClean.some(p => p.includes(custPhoneClean) || custPhoneClean.includes(p))) {
        score += 60;
      }
    }

    // Check email match
    if (customer.email && lowerText.includes(customer.email.toLowerCase())) {
      score += 40;
    }

    if (score > 0) {
      scoredMatches.push({ customer, score });
    }
  }

  // Sort by highest score first, return top 3
  scoredMatches.sort((a, b) => b.score - a.score);
  return scoredMatches.slice(0, 3).map(sm => sm.customer);
}
