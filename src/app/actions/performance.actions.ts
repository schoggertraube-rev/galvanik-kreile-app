"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

export async function getOrdersKPIs(): Promise<never> {
  if (!isFoundationAreaEnabled("Legacy-Performance-Kennzahlen")) {
    foundationUnavailableAction("Legacy-Performance-Kennzahlen");
  }
  foundationUnavailableAction("Legacy-Performance-Kennzahlen");
}

export async function getInquiriesFunnel(): Promise<never> {
  if (!isFoundationAreaEnabled("Legacy-Performance-Kennzahlen")) {
    foundationUnavailableAction("Legacy-Performance-Kennzahlen");
  }
  foundationUnavailableAction("Legacy-Performance-Kennzahlen");
}

export async function getUsageStats(): Promise<never> {
  if (!isFoundationAreaEnabled("Legacy-Performance-Kennzahlen")) {
    foundationUnavailableAction("Legacy-Performance-Kennzahlen");
  }
  foundationUnavailableAction("Legacy-Performance-Kennzahlen");
}
