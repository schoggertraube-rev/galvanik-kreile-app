"use server";

import { db } from "@/db";
import { payments } from "@/db/schema";
import { requireFinanceRead } from "@/lib/server/financeAuthorization";
import { desc, eq } from "drizzle-orm";

export type PaymentLedgerEntry = {
  id: string;
  orderId: string | null;
  amountEur: number;
  status: string;
  provider: string;
  providerStatus: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type PaymentLedgerSnapshot = {
  entries: PaymentLedgerEntry[];
  appForwarderConfigured: boolean;
  providerAvailability: "not_checked";
  generatedAt: string;
};

function boundedStatus(value: string | null, field: string): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 80) throw new Error(`PAYMENT_DATA_INVALID:${field}`);
  return normalized;
}

export async function getPaymentLedgerSnapshotAction(): Promise<PaymentLedgerSnapshot> {
  const actor = await requireFinanceRead();
  const rows = await db
    .select({
      id: payments.id,
      orderId: payments.orderId,
      amountEur: payments.amountEur,
      status: payments.status,
      provider: payments.provider,
      providerStatus: payments.mollieStatus,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
    })
    .from(payments)
    .where(eq(payments.tenantId, actor.tenantId))
    .orderBy(desc(payments.createdAt))
    .limit(50);

  return {
    entries: rows.map((row) => {
      const amountEur = Number(row.amountEur);
      if (!Number.isFinite(amountEur) || amountEur < 0) throw new Error("PAYMENT_DATA_INVALID:amount");
      return {
        id: row.id,
        orderId: row.orderId,
        amountEur,
        status: boundedStatus(row.status, "status")!,
        provider: boundedStatus(row.provider, "provider")!,
        providerStatus: boundedStatus(row.providerStatus, "provider_status"),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt?.toISOString() ?? null,
      };
    }),
    appForwarderConfigured: Boolean(
      (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
      && process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    providerAvailability: "not_checked",
    generatedAt: new Date().toISOString(),
  };
}
