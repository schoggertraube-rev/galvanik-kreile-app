"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

function unavailableWarendurchlauf(): never {
  if (!isFoundationAreaEnabled("Warendurchlauf")) {
    foundationUnavailableAction("Warendurchlauf");
  }
  foundationUnavailableAction("Warendurchlauf");
}

export async function getStationOrders(_stationId: string): Promise<never> {
void _stationId;
  return unavailableWarendurchlauf();
}

export async function getStationReadyOrders(_stationId: string): Promise<never> {
void _stationId;
  return unavailableWarendurchlauf();
}

export async function startProcessingStation(_input: {
  orderId: string;
  expectedStation: string;
  expectedStatus: string;
  clientEventId: string;
}): Promise<never> {
void _input;
  return unavailableWarendurchlauf();
}

export async function completeProcessingStation(_input: {
  orderId: string;
  expectedStation: string;
  expectedStatus: string;
  clientEventId: string;
}): Promise<never> {
void _input;
  return unavailableWarendurchlauf();
}

export async function getWarendurchlaufKPIs(): Promise<never> {
  return unavailableWarendurchlauf();
}
