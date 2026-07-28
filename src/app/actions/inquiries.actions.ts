"use server";

import type { QuoteRequest } from "@/lib/repositories/inquiriesRepository";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

function inquiriesUnavailable(): never {
  if (!isFoundationAreaEnabled("Anfragen und Angebotserfassung")) {
    return foundationUnavailableAction("Anfragen und Angebotserfassung");
  }
  return foundationUnavailableAction("Anfragen und Angebotserfassung");
}

export async function getInquiries(): Promise<QuoteRequest[]> {
  return inquiriesUnavailable();
}

export async function getOpenInquiriesCount(): Promise<number> {
  return inquiriesUnavailable();
}

export async function createInquiry(data: Record<string, unknown>): Promise<QuoteRequest> {
  void data;
  return inquiriesUnavailable();
}

export async function updateInquiry(
  id: string,
  changes: Partial<QuoteRequest>,
): Promise<QuoteRequest | null> {
  void id;
  void changes;
  return inquiriesUnavailable();
}
