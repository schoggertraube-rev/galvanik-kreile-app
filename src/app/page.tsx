import { redirect } from "next/navigation";
import { resolveAuthorization } from "@/lib/server/authorization";
import { RolfHome } from "@/components/home/RolfHome";
import { WerkstattHome } from "@/components/home/WerkstattHome";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) redirect("/start");

  const { role } = authorization.data;
  if (role === "admin" || role === "developer") redirect("/settings");
  if (role === "werkstatt") return <WerkstattHome authorization={authorization.data} />;
  if (role === "buero" || role === "meister" || role === "readonly") {
    return <RolfHome authorization={authorization.data} />;
  }

  return null;
}
