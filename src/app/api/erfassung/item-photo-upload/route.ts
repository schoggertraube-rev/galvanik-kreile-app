import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Item photo storage and analysis await a validated source and receipt contract. */
export async function POST(_request: Request) {
return foundationUnavailableResponse("Teilefoto-Upload", _request);
}
