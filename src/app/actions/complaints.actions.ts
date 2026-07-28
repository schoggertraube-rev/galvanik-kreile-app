"use server";

import { db, isDatabaseConfigured } from "@/db";
import { complaints } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

function assertComplaintContract(): void {
  if (!isFoundationAreaEnabled("Reklamationen")) {
    foundationUnavailableAction("Reklamationen");
  }
}

export async function getComplaints() {
  assertComplaintContract();
  if (!isDatabaseConfigured()) return [];
  try {
    const dbComplaints = await db.select().from(complaints).orderBy(complaints.createdAt);
    return dbComplaints;
  } catch (error) {
    console.error("Failed to get complaints from DB:", error);
    return [];
  }
}

export async function getByOrder(orderId: string) {
  assertComplaintContract();
  if (!isDatabaseConfigured()) return [];
  try {
    const dbComplaints = await db.select().from(complaints).where(eq(complaints.orderId, orderId)).orderBy(complaints.createdAt);
    return dbComplaints;
  } catch (error) {
    console.error("Failed to get complaints for order from DB:", error);
    return [];
  }
}

export async function createComplaint(data: {
  id?: string;
  orderId: string;
  customerId: string;
  itemId?: string;
  reason: string;
  stationId?: string;
  description?: string;
  photoIds?: string[];
}) {
  assertComplaintContract();
  if (!isDatabaseConfigured()) return null;
  try {
    const complaintId = data.id || createId();
    
    const newComplaint = {
      id: complaintId,
      tenantId: "galvanik-kreile",
      orderId: data.orderId,
      customerId: data.customerId,
      itemId: data.itemId || null,
      reason: data.reason,
      stationId: data.stationId || null,
      description: data.description || "",
      photoIds: data.photoIds || [],
      status: "open",
    };
    
    await db.insert(complaints).values(newComplaint);
    
    return newComplaint;
  } catch (error) {
    console.error("Failed to create complaint in DB:", error);
    return null;
  }
}

export async function updateComplaint(id: string, changes: {
  reason?: string;
  description?: string;
  status?: string;
  resolution?: string;
  resolvedAt?: Date;
  photoIds?: string[];
}) {
  assertComplaintContract();
  if (!isDatabaseConfigured()) return null;
  try {
    await db.update(complaints).set(changes).where(eq(complaints.id, id));
    return { id, ...changes };
  } catch (error) {
    console.error("Failed to update complaint in DB:", error);
    return null;
  }
}

export async function resolveComplaint(id: string, resolution: string) {
  assertComplaintContract();
  if (!isDatabaseConfigured()) return null;
  try {
    const changes = {
      status: "resolved",
      resolution,
      resolvedAt: new Date()
    };
    await db.update(complaints).set(changes).where(eq(complaints.id, id));
    return { id, ...changes };
  } catch (error) {
    console.error("Failed to resolve complaint in DB:", error);
    return null;
  }
}
