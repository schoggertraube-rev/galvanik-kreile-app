import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { isAppRole } from "@/lib/auth/authorizationContract";
import type { StartUserDto } from "@/lib/auth/userDtos";
import { createPinLoginHandle } from "@/lib/server/pinLoginHandle";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

export async function readActiveStartUsers(): Promise<
  | { code: "OK"; users: StartUserDto[] }
  | { code: "UNAVAILABLE" }
> {
  try {
    const rows = await db
      .select({
        id: appUsers.id,
        fullName: appUsers.fullName,
        shortCode: appUsers.shortCode,
        designation: appUsers.designation,
        role: appUsers.role,
        pinHash: appUsers.pinHash,
      })
      .from(appUsers)
      .where(and(eq(appUsers.tenantId, KREILE_TENANT_SLUG), eq(appUsers.active, true)))
      .orderBy(appUsers.fullName, appUsers.id);

    const validRows = rows.filter((row) =>
      row.fullName.trim()
      && row.shortCode?.trim()
      && row.designation?.trim()
      && isAppRole(row.role)
      && row.pinHash,
    );
    if (validRows.length === 0) return { code: "UNAVAILABLE" };

    return {
      code: "OK",
      users: validRows.map((row) => ({
        loginHandle: createPinLoginHandle(row.id),
        fullName: row.fullName,
        shortCode: row.shortCode!,
        designation: row.designation!,
        role: row.role as StartUserDto["role"],
      })),
    };
  } catch {
    return { code: "UNAVAILABLE" };
  }
}
