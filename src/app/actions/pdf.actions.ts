"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

export async function generateOrderLabel(_orderIds: string | string[]): Promise<never> {
  if (!isFoundationAreaEnabled("Etikettendruck")) {
    foundationUnavailableAction("Etikettendruck");
  }
  foundationUnavailableAction("Etikettendruck");
}

export async function generateDeliveryNote(_orderIds: string | string[]): Promise<never> {
  if (!isFoundationAreaEnabled("Lieferschein")) {
    foundationUnavailableAction("Lieferschein");
  }
  foundationUnavailableAction("Lieferschein");
}
