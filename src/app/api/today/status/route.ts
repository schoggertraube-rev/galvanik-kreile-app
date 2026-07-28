import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Daily status must not claim an unproved workshop state. */
export async function GET() {
  return foundationUnavailableResponse("Tagesstatus");
}
