import { redirect } from "next/navigation";
import { resolveAuthorization } from "@/lib/server/authorization";
import { ProductActorAccessUnavailable } from "@/components/foundation/FoundationUnavailable";
import { readSettingsAction } from "@/app/actions/settings.actions";
import { SettingsAdminClient } from "./SettingsAdminClient";
import type { SystemSettingsSnapshot } from "@/modules/fundament/public";

const SETTINGS_ROLES = new Set(["meister", "admin", "developer"]);

/** Server-side composition seam for role-based settings access. */
export async function SettingsAppAdapter() {
  const result = await resolveAuthorization();
  if (!result.ok) {
    if (result.reason === "NO_SESSION" || result.reason === "INVALID_SESSION") {
      redirect("/start");
    }
    return <ProductActorAccessUnavailable />;
  }

  if (!SETTINGS_ROLES.has(result.data.role)) redirect("/");
  const settings = await readSettingsAction();
  if (settings.code !== "OK") return <ProductActorAccessUnavailable />;
  const snapshot: SystemSettingsSnapshot = settings.snapshot;
  return <SettingsAdminClient initialSnapshot={snapshot} initialServices={settings.services} />;
}
