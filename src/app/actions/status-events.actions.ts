"use server";

import type { ActionResult } from "@/lib/server/authHelper";

const NOT_AVAILABLE = "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.";

function notAvailable<T>(): ActionResult<T> {
  return { ok: false, error: "CONFLICT", message: NOT_AVAILABLE };
}

export async function createStatusEvent(_data: {
  orderId: string;
  eventType: string;
  tenantId?: string;
  itemId?: string;
  workerId?: string;
  notes?: string;
  payload?: Record<string, unknown>;
  status?: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  void _data;
  return notAvailable();
}

export async function getStatusEventsByOrderId(_orderId: string): Promise<ActionResult<Record<string, unknown>[]>> {
  void _orderId;
  return notAvailable();
}

export async function getStatusEventsByItemId(_itemId: string): Promise<ActionResult<Record<string, unknown>[]>> {
  void _itemId;
  return notAvailable();
}

export async function getRecentStatusEvents(_limit = 10): Promise<ActionResult<Record<string, unknown>[]>> {
  void _limit;
  return notAvailable();
}
