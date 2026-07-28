import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Email dispatch awaits sender identity, consent, delivery and receipt contracts. */
export async function POST(_request: Request) {
  return foundationUnavailableResponse("E-Mail-Versand");
}
