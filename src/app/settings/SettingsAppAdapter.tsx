import { redirect } from "next/navigation";
import { resolveProductActorAuthorization } from "@/lib/server/productActorReadiness";
import { getProductIdentityByKey } from "@/lib/auth/authorizationContract";
import { ProductActorAccessUnavailable } from "@/components/foundation/FoundationUnavailable";
import { SystemAdminView } from "@/modules/fundament/public";

/** Server-side composition seam for the separately authenticated Gregor entry. */
export async function SettingsAppAdapter() {
  const result = await resolveProductActorAuthorization();
  if (!result.ok) {
    if (result.reason === "NO_SESSION" || result.reason === "INVALID_SESSION") {
      redirect("/start");
    }
    return (
      <ProductActorAccessUnavailable
        supportReference={result.supportReference}
      />
    );
  }

  if (result.data.actor.key !== "gregor") redirect("/");
  const identity = getProductIdentityByKey("gregor");

  return (
    <SystemAdminView
      displayName={identity.name}
      responsibility={identity.responsibility}
    />
  );
}
