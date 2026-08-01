import { StartScreenClient } from "@/components/start/StartScreenClient";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { PIN_LOGIN_ROLES } from "@/lib/auth/pinPolicy";
import { toStartUserDto, type StartUserDto } from "@/lib/auth/userDtos";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  let users: StartUserDto[] = [];
  
  try {
    const dbUsers = await db.select({
      id: appUsers.id,
      fullName: appUsers.fullName,
      role: appUsers.role,
    })
      .from(appUsers)
      .where(
        and(
          eq(appUsers.tenantId, "galvanik-kreile"),
          eq(appUsers.active, true),
          inArray(appUsers.role, [...PIN_LOGIN_ROLES]),
          isNotNull(appUsers.pinHash),
        ),
      );

    users = dbUsers.map(toStartUserDto);
  } catch (err) {
    console.error("Failed to fetch start users:", err);
    users = [];
  }

  return <StartScreenClient users={users} />;
}
