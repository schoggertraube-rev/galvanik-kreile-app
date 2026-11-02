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

function recognitionRank(customer: SearchableCustomer, textWords: Set<string>, fullText: string): number {
  const names = [customer.companyName, customer.name]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => words(value).filter((word) => word.length >= 4 && !NAME_EXCLUSIONS.has(word)));
  const contacts = [words(customer.contactPerson ?? "").filter((word) => word.length >= 4)];
  const phrase = (parts: string[]) => parts.join(" ");
  if (names.some((parts) => parts.length > 0 && phrase(parts) === fullText)) return 0;
  if (names.some((parts) => parts.length > 0 && parts.every((word) => textWords.has(word)))) return 1;
  if (contacts.some((parts) => parts.length > 0 && phrase(parts) === fullText)) return 2;
  if (contacts.some((parts) => parts.length > 0 && parts.every((word) => textWords.has(word)))) return 3;
  return 4;
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
  const normalizedFullText = words(fullTextQuery).join(" ");
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
    }
  }

  const customers = [...matches.values()]
    .map((customer, index) => ({ customer, index }))
    .sort((left, right) => {
      const rank = recognitionRank(left.customer, textWordSet, normalizedFullText)
        - recognitionRank(right.customer, textWordSet, normalizedFullText);
      return rank || left.index - right.index;
    })
    .slice(0, 3)
    .map(({ customer }) => customer);
  return { code: "OK", query: recognizedQuery(customers, textWords), customers };
}
