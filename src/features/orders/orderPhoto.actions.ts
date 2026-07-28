"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

export async function uploadOrderPhotoRecord(params: {
  orderId: string;
  fileUrl: string;
  fileType: string;
}): Promise<never> {
  if (!isFoundationAreaEnabled("Legacy-Auftragsfoto")) {
    return foundationUnavailableAction("Legacy-Auftragsfoto");
  }
  void params;
  return foundationUnavailableAction("Legacy-Auftragsfoto");
}
