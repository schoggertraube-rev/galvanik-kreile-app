import { StartAppAdapter } from "./StartAppAdapter";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { toStartUserDto, type StartUserDto } from "@/lib/auth/userDtos";
import { APP_TENANT_ID } from "@/lib/server/appSession";
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
      tenantId: appUsers.tenantId,
      active: appUsers.active,
    })
      .from(appUsers)
      .where(
        and(
          eq(appUsers.tenantId, APP_TENANT_ID),
          eq(appUsers.active, true),
          ne(appUsers.role, "developer"),
        ),
      );

    const eligibleUsers = dbUsers.filter(
      (user) =>
        user.tenantId === APP_TENANT_ID &&
        user.active === true &&
        (user.role === "meister" || user.role === "werkstatt"),
    );
    const visibleProfiles = eligibleUsers
      .map((user) => toStartUserDto(user, createPinLoginHandle(user.id)))
      .filter((user): user is StartUserDto => user !== null);
    const uniqueProfile = (identity: StartUserDto["identity"]) => {
      const matches = visibleProfiles.filter((user) => user.identity === identity);
      return matches.length === 1 ? matches[0] : null;
    };
    const rolf = uniqueProfile("rolf");
    const phillip = uniqueProfile("phillip");
    users = [rolf, phillip].filter((user): user is StartUserDto => user !== null);
  } catch (err) {
    console.error("Failed to fetch start users:", err);
    loginUnavailable = true;
  }

  return (
    <StartAppAdapter
      users={users}
      loginUnavailable={loginUnavailable}
    />
  );
}
