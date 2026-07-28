"use server";

import type { ActionResult } from "@/lib/server/authHelper";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

export type ItemResponse = Record<string, unknown>;

export type ItemMutation = {
  id?: string;
  orderId?: string;
  customerId?: string;
  name?: string;
  quantity?: number;
  material?: string;
  surfaceRequested?: string;
  photoIds?: string[];
  photo?: string;
};

function itemsUnavailable(): never {
  if (!isFoundationAreaEnabled("Legacy-Artikelverwaltung")) {
    return foundationUnavailableAction("Legacy-Artikelverwaltung");
  }
  return foundationUnavailableAction("Legacy-Artikelverwaltung");
}

export async function getItemsDb(): Promise<ActionResult<ItemResponse[]>> {
  return itemsUnavailable();
}

export async function getItemsByOrderDb(orderId: string): Promise<ActionResult<ItemResponse[]>> {
  void orderId;
  return itemsUnavailable();
}

export async function createItemDb(data: ItemMutation): Promise<ActionResult<ItemResponse>> {
  void data;
  return itemsUnavailable();
}

export async function updateItemDb(
  id: string,
  changes: ItemMutation,
): Promise<ActionResult<ItemResponse>> {
  void id;
  void changes;
  return itemsUnavailable();
}

export async function deleteItemDb(id: string): Promise<ActionResult<{ success: boolean }>> {
  void id;
  return itemsUnavailable();
}
