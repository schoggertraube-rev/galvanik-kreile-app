import { JahresplanClient } from "./JahresplanClient";
import { resolveAuthorization } from "@/lib/server/authorization";

export default async function JahresplanPage() {
  const authorization = await resolveAuthorization();
  const role = authorization.ok ? authorization.data.role : undefined;
  const isDevOrAdmin = role === 'developer' || role === 'admin';

  return <JahresplanClient isDevOrAdmin={isDevOrAdmin} />;
}
