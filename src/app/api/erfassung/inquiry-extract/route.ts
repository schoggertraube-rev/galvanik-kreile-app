import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Inquiry extraction has no validated source, tenant, or price contract. */
export async function POST(_request: Request) {
  return foundationUnavailableResponse("Anfrage-Extraktion");
}
