import { notAvailableResponse } from "@/lib/server/quarantine";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  void request;
  void context;
  return notAvailableResponse();
}
