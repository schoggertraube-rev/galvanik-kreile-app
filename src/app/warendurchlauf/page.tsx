import { resolveAuthorization } from "@/lib/server/authorization";
import { WerkstattHome } from "@/components/home/WerkstattHome";
import { WerkstattAppAdapter } from "./WerkstattAppAdapter";

export const dynamic = "force-dynamic";

export default async function WarendurchlaufPage() {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    const unavailable = authorization.reason === "AUTHORIZATION_UNAVAILABLE";
    return (
      <WerkstattAppAdapter
        view={{
          kind: unavailable ? "error" : "denied",
          message: unavailable
            ? "Werkstattdaten konnten nicht sicher geladen werden."
            : "Zugriff nicht erlaubt.",
        }}
      />
    );
  }
  return WerkstattHome({ authorization: authorization.data });
}
