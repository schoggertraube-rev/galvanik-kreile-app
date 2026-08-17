"use server";

import type { QuoteRequest } from "@/lib/repositories/inquiriesRepository";

export async function getInquiries(): Promise<QuoteRequest[]> {
  throw new Error("NOT_AVAILABLE: Sicherer W3-Read-Vertrag fehlt.");
}

export async function getOpenInquiriesCount(): Promise<number> {
  throw new Error("NOT_AVAILABLE: Sicherer W3-Read-Vertrag fehlt.");
}

export async function createInquiry(data: Record<string, unknown>) {
  void data;
  return { success: false, error: "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt." };
}

export async function updateInquiry(id: string, changes: Partial<QuoteRequest>): Promise<QuoteRequest | null> {
  void id;
  void changes;
  return null;
}
