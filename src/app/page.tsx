import { redirect } from "next/navigation";
import { resolveAuthorization } from "@/lib/server/authorization";
import { RolfHome } from "@/components/home/RolfHome";
import { WerkstattHome } from "@/components/home/WerkstattHome";

export const dynamic = "force-dynamic";

/** The single role-aware home composition. Authentication remains server-side. */
export default async function RootPage() {
  const authorization = await resolveAuthorization();

  if (!authorization.ok) redirect("/start");
  if (authorization.data.role === "admin" || authorization.data.role === "developer") {
    redirect("/settings");
  }
  if (authorization.data.role === "werkstatt") {
    return WerkstattHome({ authorization: authorization.data });
  }
  if (["buero", "meister", "readonly"].includes(authorization.data.role)) {
    return RolfHome({ authorization: authorization.data });
  }
  return (
    <section aria-labelledby="home-denied-title" role="status">
      <h1 id="home-denied-title">Startseite nicht freigegeben</h1>
      <p>Diese Rolle ist keinem kanonischen Einstieg zugeordnet.</p>
    </section>
  );
}
