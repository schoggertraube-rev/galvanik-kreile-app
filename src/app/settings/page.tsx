import { SettingsAppAdapter } from "./SettingsAppAdapter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const requested = (await searchParams).returnTo;
  const returnTo = typeof requested === "string" && requested.startsWith("/") && !requested.startsWith("//")
    ? requested
    : null;
  return <SettingsAppAdapter returnTo={returnTo} />;
}
