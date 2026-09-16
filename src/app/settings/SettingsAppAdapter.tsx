import { redirect } from "next/navigation";
import { getProductIdentity } from "@/lib/auth/authorizationContract";
import { resolveAuthorization } from "@/lib/server/authorization";
import { SystemAdminView } from "@/modules/fundament/public";

/** Server-side composition seam for the separately authenticated Gregor entry. */
export async function SettingsAppAdapter() {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) redirect("/start");

  const identity = getProductIdentity(authorization.data.userId);
  if (
    identity?.name !== "Gregor"
    || identity.responsibility !== "Systemadministrator"
    || (authorization.data.role !== "admin" && authorization.data.role !== "developer")
  ) redirect("/");

  return (
    <SystemAdminView
      displayName={identity.name}
      responsibility={identity.responsibility}
    />
  );
}
