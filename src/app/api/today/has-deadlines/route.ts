import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Deadline status needs a canonical order and due-date contract. */
export async function GET() {
  return foundationUnavailableResponse("Tagesfristen");
}
