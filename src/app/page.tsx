import { redirect } from "next/navigation";
import { resolveProductActorAuthorization } from "@/lib/server/productActorReadiness";
import { RolfHome } from "@/components/home/RolfHome";
import { loadWerkstattHome } from "@/components/home/WerkstattHome";
import { WerkstattAppAdapter } from "@/app/warendurchlauf/WerkstattAppAdapter";
import { ProductActorAccessUnavailable } from "@/components/foundation/FoundationUnavailable";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await resolveProductActorAuthorization();
  if (!result.ok) {
    if (result.reason === "NO_SESSION" || result.reason === "INVALID_SESSION") {
      redirect("/start");
    }
    return (
      <ProductActorAccessUnavailable
        supportReference={result.supportReference}
      />
    );
  }

  const { actor, authorization } = result.data;
  if (actor.key === "gregor") redirect("/settings");
  if (actor.key === "phillip") {
    return (
      <WerkstattAppAdapter view={await loadWerkstattHome(authorization)} />
    );
  }
  if (actor.key === "rolf") {
    return <RolfHome authorization={authorization} />;
  }

  return <ProductActorAccessUnavailable />;
}
