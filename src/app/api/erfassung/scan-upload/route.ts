import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/**
 * Upload, storage and OCR persistence have no proven tenant/auth contract.
 * Do not initialize storage, OCR, or the database for an unavailable route.
 */
export async function POST(_request: Request) {
return foundationUnavailableResponse("Scan-Upload", _request);
}
