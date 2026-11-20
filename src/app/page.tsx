import { redirect } from "next/navigation";
import { hasAuthorizationArea, resolveAuthorization } from "@/lib/server/authorization";
import { HomeAppAdapter } from "@/app/HomeAppAdapter";
import { ProductActorAccessUnavailable } from "@/components/foundation/FoundationUnavailable";
import {withPageReadBudget} from '@/db/readBudget';
import {DEFAULT_PAGE_READ_SETTINGS} from '@/db/readBudget';

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await withPageReadBudget(resolveAuthorization,DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs);
  if (!result.ok) {
    if (result.reason === "NO_SESSION" || result.reason === "INVALID_SESSION") {
      redirect("/start");
    }
    return (
      <ProductActorAccessUnavailable
      />
    );
  }

  const authorization = result.data;
  if (hasAuthorizationArea(authorization, "wartung")) redirect("/settings");
  return <HomeAppAdapter authorization={authorization} />;
}
