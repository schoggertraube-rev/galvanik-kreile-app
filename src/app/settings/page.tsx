import { requireAdminOrDeveloper } from "@/lib/auth/permissions";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  await requireAdminOrDeveloper();
  return <SettingsClient />;
}
