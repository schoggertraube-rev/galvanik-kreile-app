import { StartScreenClient } from "@/components/start/StartScreenClient";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { toStartUserDto, type StartUserDto } from "@/lib/auth/userDtos";
import { createPinLoginSelector } from "@/lib/server/pinLoginSelector";
import { canUsePinLoginRole, isAppRole } from "@/lib/auth/authorizationContract";

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
      .where(eq(appUsers.active, true));

    const eligibleUsers = dbUsers.filter(
      (user) => isAppRole(user.role) && canUsePinLoginRole(user.role),
    );

    users = await Promise.all(eligibleUsers.map(async (user) => toStartUserDto({
      selector: await createPinLoginSelector(user.id),
      fullName: user.fullName,
    })));
  } catch (err) {
    console.error("Failed to fetch start users:", err);
    users = [];
  }

  return <StartScreenClient users={users} />;
}
