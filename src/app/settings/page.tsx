import { SettingsAppAdapter } from "./SettingsAppAdapter";
import {settingsReturnTo} from "@/lib/settingsReturnTo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; tab?:string }> }) {
  const params=await searchParams;
  return <SettingsAppAdapter returnTo={settingsReturnTo(params.returnTo)} openCatalog={params.tab==='catalog'} />;
}
