"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

export type LegacyCustomerCardRecord = Record<string, unknown>;

export type LegacyCustomerCardResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

function customerCardUnavailable(): never {
  if (!isFoundationAreaEnabled("Legacy-Kundenkarte")) {
    return foundationUnavailableAction("Legacy-Kundenkarte");
  }

  return foundationUnavailableAction("Legacy-Kundenkarte");
}

/**
 * Compatibility surface for the old customer-card tabs. The historical
 * adapter mixed cross-domain reads and writes without a proved evidence,
 * permission and tenant contract, so it cannot be used as a release path.
 */
export async function getCustomerCard(
  customerId: string,
): Promise<LegacyCustomerCardResult<LegacyCustomerCardRecord>> {
  void customerId;
  return customerCardUnavailable();
}

export async function getCustomerOrders(
  customerId: string,
): Promise<LegacyCustomerCardResult<LegacyCustomerCardRecord[]>> {
  void customerId;
  return customerCardUnavailable();
}

export async function getCustomerTimeline(
  customerId: string,
): Promise<LegacyCustomerCardResult<LegacyCustomerCardRecord[]>> {
  void customerId;
  return customerCardUnavailable();
}

export async function getCustomerFinancials(
  customerId: string,
): Promise<LegacyCustomerCardResult<{ invoices: LegacyCustomerCardRecord[] }>> {
  void customerId;
  return customerCardUnavailable();
}

export async function getCustomerSimilarOrders(
  customerId: string,
  orderId?: string,
): Promise<LegacyCustomerCardResult<LegacyCustomerCardRecord[]>> {
  void customerId;
  void orderId;
  return customerCardUnavailable();
}

export async function getCustomerItems(
  customerId: string,
): Promise<LegacyCustomerCardResult<LegacyCustomerCardRecord[]>> {
  void customerId;
  return customerCardUnavailable();
}

export async function getCustomerPrices(
  customerId: string,
): Promise<LegacyCustomerCardResult<LegacyCustomerCardRecord[]>> {
  void customerId;
  return customerCardUnavailable();
}

export async function getCustomerComplaints(
  customerId: string,
): Promise<LegacyCustomerCardResult<LegacyCustomerCardRecord[]>> {
  void customerId;
  return customerCardUnavailable();
}

export async function updateCustomerCore(
  customerId: string,
  patch: Record<string, unknown>,
): Promise<LegacyCustomerCardResult<never>> {
  void customerId;
  void patch;
  return customerCardUnavailable();
}

export async function addCustomerTag(
  customerId: string,
  tag: string,
): Promise<LegacyCustomerCardResult<never>> {
  void customerId;
  void tag;
  return customerCardUnavailable();
}

export async function removeCustomerTag(
  customerId: string,
  tag: string,
): Promise<LegacyCustomerCardResult<never>> {
  void customerId;
  void tag;
  return customerCardUnavailable();
}
