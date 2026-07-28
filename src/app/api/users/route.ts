import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** User enumeration must not expose legacy mock identities. */
export async function GET() {
  return foundationUnavailableResponse("Benutzer-API");
}
