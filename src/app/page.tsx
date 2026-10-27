import { redirect } from "next/navigation";
import { resolveAuthorization } from "@/lib/server/authorization";
import { HomeAppAdapter } from "@/app/HomeAppAdapter";
import { ProductActorAccessUnavailable } from "@/components/foundation/FoundationUnavailable";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await resolveAuthorization();
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
  if (authorization.role === "admin" || authorization.role === "developer") redirect("/settings");
  if (authorization.role === "werkstatt" || authorization.role === "meister" || authorization.role === "buero" || authorization.role === "readonly") {
    return <HomeAppAdapter authorization={authorization} />;
  }

  return <ProductActorAccessUnavailable />;
}
