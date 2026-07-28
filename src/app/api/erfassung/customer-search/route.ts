import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Customer capture has not passed the tenant and audit proof gates. */
export async function GET(_request: Request) {
return foundationUnavailableResponse("Kundensuche in der Erfassung", _request);
}
