import { redirect } from "next/navigation";
import { resolveAuthorization } from "@/lib/server/authorization";
import { getProductIdentity } from "@/lib/auth/authorizationContract";
import { RolfHome } from "@/components/home/RolfHome";
import { loadWerkstattHome } from "@/components/home/WerkstattHome";
import { WerkstattAppAdapter } from "@/app/warendurchlauf/WerkstattAppAdapter";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) redirect("/start");

  const { role, userId } = authorization.data;
  const productIdentity = getProductIdentity(userId);
  if (!productIdentity) return redirect("/start");
  if (productIdentity.name === "Gregor" && (role === "admin" || role === "developer")) return redirect("/settings");
  if (productIdentity.name === "Phillip" && role === "werkstatt") {
    return <WerkstattAppAdapter view={await loadWerkstattHome(authorization.data)} />;
  }
  if (productIdentity.name === "Rolf" && role === "meister") {
    return <RolfHome authorization={authorization.data} />;
  }

  return redirect("/start");
}
