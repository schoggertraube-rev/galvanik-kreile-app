import { isAdminOrDeveloper } from "@/lib/auth/permissions";
import { KontrolleDashboardClient } from "./KontrolleDashboardClient";

export default async function KontrollePage() {
  const isDevOrAdmin = await isAdminOrDeveloper();

  return <KontrolleDashboardClient isDevOrAdmin={isDevOrAdmin} />;
}
