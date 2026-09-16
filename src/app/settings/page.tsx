import { SettingsAppAdapter } from "./SettingsAppAdapter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SettingsPage() {
  return <SettingsAppAdapter />;
}
