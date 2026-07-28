import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/**
 * Scan status has no validated product-data contract yet.  Keep the endpoint
 * explicitly unavailable and, crucially, do not import the legacy database
 * implementation: static production builds must not require a database secret
 * for an endpoint that cannot serve a request.
 */
export async function GET(_request: Request) {
return foundationUnavailableResponse("Scan-Status", _request);
}
