"use server";

import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers, customers, orders } from "@/db/schema";
import { resolveAuthorization } from "@/lib/server/authorization";

export type SystemStats = {
  available: boolean;
  provider: string;
  supabaseHost: string;
  reachable: boolean | null;
  orders: number | null;
  customers: number | null;
  users: number | null;
  lastCheck: string;
  lastError: string | null;
};

function providerMetadata() {
  const provider = process.env.NEXT_PUBLIC_DATA_PROVIDER || "local";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let supabaseHost = "";
  try {
    supabaseHost = new URL(supabaseUrl).host;
  } catch {
    supabaseHost = supabaseUrl ? "(ungültige URL)" : "(nicht konfiguriert)";
  }
  return { provider, supabaseHost };
}

export async function getSystemStats(): Promise<SystemStats> {
  const { provider, supabaseHost } = providerMetadata();
  const lastCheck = new Date().toISOString();
  const authorization = await resolveAuthorization();
  if (!authorization.ok || !authorization.data.permissions.includes("perm_sys_diag")) {
    return {
      available: false,
      provider: "nicht freigegeben",
      supabaseHost: "",
      reachable: null,
      orders: null,
      customers: null,
      users: null,
      lastCheck,
      lastError: "Systemdiagnose ist für diese Rolle nicht freigegeben.",
    };
  }

  if (provider !== "supabase") {
    return {
      available: false,
      provider,
      supabaseHost,
      reachable: null,
      orders: null,
      customers: null,
      users: null,
      lastCheck,
      lastError: "Die produktive Supabase-Datenquelle ist nicht konfiguriert.",
    };
  }

  try {
    const tenantId = authorization.data.tenantId;
    const [orderResult, customerResult, userResult] = await Promise.all([
      db.select({ value: count() }).from(orders).where(eq(orders.tenantId, tenantId)),
      db.select({ value: count() }).from(customers).where(eq(customers.tenantId, tenantId)),
      db.select({ value: count() }).from(appUsers).where(eq(appUsers.tenantId, tenantId)),
    ]);
    return {
      available: true,
      provider,
      supabaseHost,
      reachable: true,
      orders: orderResult[0]?.value ?? null,
      customers: customerResult[0]?.value ?? null,
      users: userResult[0]?.value ?? null,
      lastCheck,
      lastError: null,
    };
  } catch (error) {
    console.error("system stats query failed", error);
    return {
      available: false,
      provider,
      supabaseHost,
      reachable: false,
      orders: null,
      customers: null,
      users: null,
      lastCheck,
      lastError: "Systemdiagnose konnte nicht geladen werden.",
    };
  }
}

export async function runSupabaseWriteTest(): Promise<{
  success: false;
  message: string;
  durationMs: 0;
}> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok || !authorization.data.permissions.includes("perm_sys_diag")) {
    return { success: false, message: "Systemdiagnose ist für diese Rolle nicht freigegeben.", durationMs: 0 };
  }
  return {
    success: false,
    message: "Der mutierende Schreibtest ist gesperrt: Es gibt keinen freigegebenen, tenantgebundenen Idempotenz- und Auditvertrag. Es wurden keine Daten geschrieben oder gelöscht.",
    durationMs: 0,
  };
}
