import { isAdminOrDeveloper, isDeveloper } from "@/lib/auth/permissions";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const isAdmin = await isAdminOrDeveloper();
  const isDev = await isDeveloper();
  return <SettingsClient isAdmin={isAdmin} isDeveloper={isDev} />;
}
