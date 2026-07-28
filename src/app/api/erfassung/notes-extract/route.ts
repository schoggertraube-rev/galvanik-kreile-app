import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Note extraction has no validated source, retention, or receipt contract. */
export async function POST(_request: Request) {
return foundationUnavailableResponse("Notiz-Extraktion", _request);
}
