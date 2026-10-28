import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { isAppRole } from "@/lib/auth/authorizationContract";
import type { StartUserDto } from "@/lib/auth/userDtos";
import { createPinLoginHandle } from "@/lib/server/pinLoginHandle";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

export async function readActiveStartUsers(): Promise<
  | { code: "OK"; users: StartUserDto[]; skipped: number }
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
        email: appUsers.email,
        areas: sql<string[]>`(
          SELECT COALESCE(array_agg(rights.bereich ORDER BY rights.bereich), ARRAY[]::text[])
          FROM public.app_user_rights rights
          WHERE rights.tenant_id = ${appUsers.tenantId}
            AND rights.user_id = ${appUsers.id}
        )`,
      })
      .from(appUsers)
      .where(and(eq(appUsers.tenantId, KREILE_TENANT_SLUG), eq(appUsers.active, true)))
      .orderBy(appUsers.fullName, appUsers.id);

    const validRows = rows.filter((row) => {
      const emailLoginAvailable = Boolean(row.email?.trim() && row.areas.includes("wartung"));
      return row.fullName.trim()
        && row.shortCode?.trim()
        && isAppRole(row.role)
        && (row.pinHash || emailLoginAvailable);
    });
    if (validRows.length === 0) return { code: "UNAVAILABLE" };
    const skipped = rows.length - validRows.length;
    if (skipped > 0) console.warn(`Anmeldeliste: ${skipped} aktive Login-Zeile(n) wegen unvollständiger Angaben übersprungen.`);

    return {
      code: "OK",
      skipped,
      users: validRows.map((row) => ({
        loginHandle: createPinLoginHandle(row.id),
        fullName: row.fullName,
        shortCode: row.shortCode!,
        designation: row.designation?.trim() ?? "",
        role: row.role as StartUserDto["role"],
        emailLoginAvailable: Boolean(row.email?.trim() && row.areas.includes("wartung")),
      })),
    };
  } catch {
    return { code: "UNAVAILABLE" };
  }
}
