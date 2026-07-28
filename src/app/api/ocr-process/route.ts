import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** OCR has not passed source, tenant, retention, and receipt validation. */
export async function POST(_request: Request) {
return foundationUnavailableResponse("OCR-Verarbeitung", _request);
}
