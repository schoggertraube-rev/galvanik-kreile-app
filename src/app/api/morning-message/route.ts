import { notAvailableResponse } from "@/lib/server/quarantine";

export async function GET(request: Request) {
  void request;
  return notAvailableResponse();
}
