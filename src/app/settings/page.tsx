import { SettingsAppAdapter } from "./SettingsAppAdapter";
import {settingsReturnTo} from "@/lib/settingsReturnTo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = settingsReturnTo((await searchParams).returnTo);
  return <SettingsAppAdapter returnTo={returnTo} />;
}
