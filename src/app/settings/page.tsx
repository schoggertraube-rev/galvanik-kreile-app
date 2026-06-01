import { isDeveloper } from "@/lib/auth/roles";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const isDev = await isDeveloper();
  return <SettingsClient isDeveloper={isDev} />;
}
