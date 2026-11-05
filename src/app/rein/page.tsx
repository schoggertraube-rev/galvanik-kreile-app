import { redirect } from "next/navigation";
import { IntakeDirectEntry } from "@/modules/eingang/public";
import { hasAuthorizationArea, resolveAuthorization } from "@/lib/server/authorization";

export default async function ReinPage() {
  const auth = await resolveAuthorization();
  if (!auth.ok) redirect("/start");
  if (!hasAuthorizationArea(auth.data, "eingang")) return <p role="alert">Eingang ist nicht freigegeben.</p>;
  return <IntakeDirectEntry />;
}
