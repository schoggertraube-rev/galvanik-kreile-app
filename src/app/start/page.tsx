import { StartScreenClient } from "@/components/start/StartScreenClient";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { toStartUserDto, type StartUserDto } from "@/lib/auth/userDtos";
import { createPinLoginHandle } from "@/lib/server/pinLoginHandle";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  let users: StartUserDto[] = [];
  let loginUnavailable = false;
  
  try {
    const dbUsers = await db.select({
      id: appUsers.id,
      fullName: appUsers.fullName,
      role: appUsers.role,
    })
      .from(appUsers)
      .where(eq(appUsers.active, true));

    // Filter out developers so they don't appear as PIN logins
    // We only want normal roles like admin, werkstatt, buero, etc.
    const eligibleUsers = dbUsers.filter(u => u.role !== "developer");

    users = eligibleUsers.map((user) =>
      toStartUserDto(user, createPinLoginHandle(user.id)),
    );
  } catch (err) {
    console.error("Failed to fetch start users:", err);
    loginUnavailable = true;
  }

  return (
    <StartScreenClient
      users={users}
      loginUnavailable={loginUnavailable}
    />
  );
}
