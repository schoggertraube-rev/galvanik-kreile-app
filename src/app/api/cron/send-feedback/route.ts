import { foundationUnavailableResponse } from "@/lib/server/foundationGate";

/** Feedback dispatch is unavailable until sender, consent and receipt contracts exist. */
export async function GET(_request: Request) {
return foundationUnavailableResponse("Feedback-Versand", _request);
}
