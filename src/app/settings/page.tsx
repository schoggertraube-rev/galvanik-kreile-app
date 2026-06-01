import { isAdminOrDeveloper } from "@/lib/auth/permissions";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const isAdmin = await isAdminOrDeveloper();
  return <SettingsClient isAdmin={isAdmin} />;
}
