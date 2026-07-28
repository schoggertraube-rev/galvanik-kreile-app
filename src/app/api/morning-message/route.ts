import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Morning messages must not invent weather or workshop advice. */
export async function GET(_request: Request) {
return foundationUnavailableResponse("Morgenhinweise", _request);
}
