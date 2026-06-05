import { StartScreenClient, StartUser } from "@/components/start/StartScreenClient";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  let users: StartUser[] = [];
  
  try {
    const dbUsers = await db.select()
      .from(appUsers)
      .where(eq(appUsers.active, true));

    // Filter out developers so they don't appear as PIN logins
    // We only want normal roles like admin, werkstatt, buero, etc.
    const eligibleUsers = dbUsers.filter(u => u.role !== "developer");

    users = eligibleUsers.map(u => {
      // Create initials (max 2 chars)
      const parts = u.fullName.trim().split(" ");
      let initials = "";
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      } else if (u.fullName.length > 0) {
        initials = u.fullName.substring(0, 2).toUpperCase();
      } else {
        initials = "?";
      }

      return {
        id: u.id,
        fullName: u.fullName,
        role: u.role,
        pinHash: u.pinHash || "1234",
        initials,
      };
    });
  } catch (err) {
    console.error("Failed to fetch start users:", err);
    // Fallback if DB is completely unreachable
    users = [
      {
        id: "1",
        fullName: "Fallback Admin",
        initials: "FA",
        role: "admin",
        pinHash: "1234",
      }
    ];
  }

  return <StartScreenClient users={users} />;
}
