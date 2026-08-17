import { notAvailableResponse } from "@/lib/server/quarantine";

export async function GET() {
  return notAvailableResponse();
}
