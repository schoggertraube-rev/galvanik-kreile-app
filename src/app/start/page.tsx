import { StartScreenClient } from "@/components/start/StartScreenClient";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
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
      .where(eq(appUsers.active, true));

    // Filter out developers so they don't appear as PIN logins
    // We only want normal roles like admin, werkstatt, buero, etc.
    const eligibleUsers = dbUsers.filter(u => u.role !== "developer");

    users = eligibleUsers.map(toStartUserDto);
  } catch (err) {
    console.error("Failed to fetch start users:", err);
    // Fallback if DB is completely unreachable
    users = [
      toStartUserDto({
        id: "1",
        fullName: "Fallback Admin",
        role: "admin",
      }),
    ];
  }

  return <StartScreenClient users={users} />;
}
