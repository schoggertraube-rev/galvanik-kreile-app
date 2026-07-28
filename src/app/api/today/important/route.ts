import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Priorities must not fall back to static workshop claims. */
export async function GET() {
  return foundationUnavailableResponse("Tagesprioritäten");
}
