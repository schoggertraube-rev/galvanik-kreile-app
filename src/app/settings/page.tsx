import { hasPermission, isDeveloper } from "@/lib/auth/permissions";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  return <SettingsClient />;
}
