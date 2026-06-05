import { hasPermission } from "@/lib/auth/permissions";
import { BuchhaltungCockpitClient } from "./BuchhaltungCockpitClient";

export const dynamic = "force-dynamic";

export default async function BuchhaltungPage() {
  const isDevOrAdmin = await hasPermission("perm_view_prices");

  if (!isDevOrAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Zugriff verweigert</h1>
        <p className="text-text-muted">Sie haben nicht die erforderlichen Rechte (Admin/Inhaber), um die Buchhaltung zu sehen.</p>
      </div>
    );
  }

  return <BuchhaltungCockpitClient />;
}
