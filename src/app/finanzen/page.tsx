import { FinanzenDashboardClient } from "./FinanzenDashboardClient";
import { isAdminOrDeveloper } from "@/lib/auth/permissions";

export default async function FinanzenPage() {
  const isDevOrAdmin = await isAdminOrDeveloper();

  if (!isDevOrAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Zugriff verweigert</h1>
        <p className="text-text-muted">Sie haben nicht die erforderlichen Rechte (Admin/Inhaber), um die Finanz-Zentrale zu sehen.</p>
      </div>
    );
  }

  return <FinanzenDashboardClient />;
}
