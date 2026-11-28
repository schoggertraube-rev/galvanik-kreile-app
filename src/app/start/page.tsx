import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { StartAppAdapter } from "./StartAppAdapter";
import type { StartUserDto } from "@/lib/auth/userDtos";
import {
  reportProductActorOperationalFailure,
} from "@/lib/server/productActorReadiness";
import { readActiveStartUsers } from "@/lib/server/startUserRead";
import { resolveAuthorization } from "@/lib/server/authorization";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  if ((await resolveAuthorization()).ok) {
    // The PIN client opens the home page after the action has set the session.
    // Avoid a second navigation in Next's render of the action response.
    if ((await headers()).has("next-action")) return null;
    redirect("/");
  }

  let users: StartUserDto[] = [];
  let loginUnavailable = false;
  let supportReference: string | undefined;
  let skippedLogins = 0;

  try {
    const result = await readActiveStartUsers();
    if (result.code !== "OK" || result.users.length === 0) {
      loginUnavailable = true;
    } else {
      users = result.users;
      skippedLogins = result.skipped;
    }
  } catch {
    loginUnavailable = true;
    supportReference = reportProductActorOperationalFailure(
      "PIN_LOGIN_SURFACE_UNAVAILABLE",
    );
  }

  return (
    <StartAppAdapter
      users={users}
      loginUnavailable={loginUnavailable}
      supportReference={supportReference}
      skippedLogins={skippedLogins}
    />
  );
}
