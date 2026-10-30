import { redirect } from "next/navigation";
import { resolveAuthorization } from "@/lib/server/authorization";
import { ProductActorAccessUnavailable } from "@/components/foundation/FoundationUnavailable";
import { readSettingsAction } from "@/app/actions/settings.actions";
import { SettingsAdminClient } from "./SettingsAdminClient";
import type { SystemSettingsSnapshot } from "@/modules/fundament/public";

/** Server-side composition seam. Writes remain gated per access area in every action. */
export async function SettingsAppAdapter({ returnTo = null }: { returnTo?: string | null } = {}) {
  const result = await resolveAuthorization();
  if (!result.ok) {
    if (result.reason === "NO_SESSION" || result.reason === "INVALID_SESSION") {
      redirect("/start");
    }
    return <ProductActorAccessUnavailable />;
  }

  const settings = await readSettingsAction();
  if (settings.code !== "OK") return <ProductActorAccessUnavailable />;
  const snapshot: SystemSettingsSnapshot = settings.snapshot;
  return <SettingsAdminClient initialSnapshot={snapshot} initialServices={settings.services} returnTo={returnTo} />;
}
