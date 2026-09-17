import { StartAppAdapter } from "./StartAppAdapter";
import type { StartUserDto } from "@/lib/auth/userDtos";
import { createPinLoginHandle } from "@/lib/server/pinLoginHandle";
import {
  readProductActorReadiness,
  reportProductActorOperationalFailure,
} from "@/lib/server/productActorReadiness";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  let users: StartUserDto[] = [];
  let loginUnavailable = false;
  let supportReference: string | undefined;

  try {
    const readiness = await readProductActorReadiness();
    if (!readiness.ok) {
      loginUnavailable = true;
      supportReference = readiness.supportReference;
    } else {
      users = (["rolf", "phillip"] as const).map((identity) => ({
        identity,
        loginHandle: createPinLoginHandle(readiness.actors[identity].actorId),
      }));
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
    />
  );
}
