import { notAvailableResponse } from "@/lib/server/quarantine";

export async function POST(request: Request) {
  void request;
  return notAvailableResponse();
}
