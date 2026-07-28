import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Free-text extraction has no validated source, retention, or receipt contract. */
export async function POST(_request: Request) {
return foundationUnavailableResponse("Freitext-Extraktion", _request);
}
