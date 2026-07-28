import { StartScreenClient } from "@/components/start/StartScreenClient";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { toStartUserDto, type StartUserDto } from "@/lib/auth/userDtos";
import { canUsePinLoginRole, isAppRole } from "@/lib/auth/authorizationContract";
import { createPinLoginSelector } from "@/lib/server/pinLoginSelector";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  let users: StartUserDto[] = [];
  let usersLoadError: string | null = null;
  
  try {
    const dbUsers = await db.select({
      id: appUsers.id,
      fullName: appUsers.fullName,
      role: appUsers.role,
      })
      .from(appUsers)
      .where(and(
        eq(appUsers.tenantId, "galvanik-kreile"),
        eq(appUsers.active, true),
      ));

    const eligibleUsers = dbUsers.filter(
      (user) => isAppRole(user.role) && canUsePinLoginRole(user.role),
    );

    users = eligibleUsers.map((user) => toStartUserDto({
      selector: createPinLoginSelector(user.id),
      fullName: user.fullName,
      role: user.role,
    }));
  } catch (err) {
    console.error("Failed to fetch start users:", err);
    usersLoadError = "Benutzerliste konnte nicht geladen werden. Der Anmeldestatus ist unbekannt.";
  }

  return <StartScreenClient users={users} usersLoadError={usersLoadError} />;
}
