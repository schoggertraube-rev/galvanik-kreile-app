import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Daily timeline must not expose static mock work events. */
export async function GET() {
  return foundationUnavailableResponse("Tageschronik");
}
