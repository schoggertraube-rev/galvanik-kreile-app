import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Customer enrichment has no validated source, tenant, or audit contract. */
export async function POST(_request: Request) {
return foundationUnavailableResponse("Kundenerkennung", _request);
}
