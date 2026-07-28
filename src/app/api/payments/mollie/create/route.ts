import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Payment creation awaits a verified provider, tenant, and immutable receipt contract. */
export async function POST(_request: Request) {
  return foundationUnavailableResponse("Zahlungsanforderung");
}
