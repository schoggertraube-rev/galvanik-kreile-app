const NAME_EXCLUSIONS = new Set([
  "autohaus",
  "metallbau",
  "schreinerei",
  "oldtimer",
  "motorrad",
  "werkstatt",
  "service",
  "handel",
  "gmbh",
  "kg",
  "ag",
  "ug",
  "ek",
  "gbr",
  "ohg",
]);

type SearchableCustomer = {
  id: string;
  name: string;
  companyName?: string | null;
  contactPerson?: string | null;
};

type CustomerSearchResult<TCustomer extends SearchableCustomer> =
  | { code: "OK"; customers: TCustomer[] }
  | { code: "DENIED" | "UNAVAILABLE"; message: string };

export type RecognizedCustomerSuggestions<TCustomer extends SearchableCustomer> =
  | { code: "OK"; query: string; customers: TCustomer[] }
  | { code: "DENIED" | "UNAVAILABLE"; message: string };

function words(value: string): string[] {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("de-DE")
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

function searchableNameWords(customer: SearchableCustomer): Set<string> {
  const names = [customer.companyName, customer.name]
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap(words)
    .filter((word) => word.length >= 4 && !NAME_EXCLUSIONS.has(word));
  const contacts = words(customer.contactPerson ?? "").filter((word) => word.length >= 4);
  return new Set([...names, ...contacts]);
}

function matchesText(customer: SearchableCustomer, textWords: Set<string>): boolean {
  return [...searchableNameWords(customer)].some((word) => textWords.has(word));
}

function recognizedQuery<TCustomer extends SearchableCustomer>(
  customers: TCustomer[],
  textWords: string[],
): string {
  if (customers.length === 1) {
    return (customers[0]?.companyName ?? customers[0]?.name ?? "").trim();
  }
  const customerWords = new Set(customers.flatMap((customer) => [...searchableNameWords(customer)]));
  return textWords.filter((word, index) => customerWords.has(word) && textWords.indexOf(word) === index).slice(0, 3).join(" ");
}

export async function findRecognizedCustomers<TCustomer extends SearchableCustomer>(
  text: string,
  search: (query: string) => Promise<CustomerSearchResult<TCustomer>>,
): Promise<RecognizedCustomerSuggestions<TCustomer>> {
  const textWords = words(text);
  const textWordSet = new Set(textWords);
  const candidates = textWords
    .filter((word, index) => word.length >= 4 && !NAME_EXCLUSIONS.has(word) && textWords.indexOf(word) === index);
  if (candidates.length === 0) return { code: "OK", query: "", customers: [] };

  const fullTextQuery = text.trim().replace(/\s+/g, " ");
  const queries = [
    ...(fullTextQuery.length <= 80 ? [fullTextQuery] : []),
    ...candidates,
  ].filter((query, index, all) => all.indexOf(query) === index);
  const matches = new Map<string, TCustomer>();

  for (const query of queries) {
    const result = await search(query);
    if (result.code !== "OK") return result;
    for (const customer of result.customers) {
      if (matchesText(customer, textWordSet)) matches.set(customer.id, customer);
      if (matches.size === 3) break;
    }
    if (matches.size === 3) break;
  }

  const customers = [...matches.values()].slice(0, 3);
  return { code: "OK", query: recognizedQuery(customers, textWords), customers };
}
