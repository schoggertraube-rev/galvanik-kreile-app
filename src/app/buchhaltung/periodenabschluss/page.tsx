import { PeriodenabschlussClient } from "./PeriodenabschlussClient";
import { getPeriodenabschlussStatusAction } from "./actions";
import { Suspense } from "react";
import { getCurrentRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function PeriodenabschlussPage() {
  const role = await getCurrentRole();
  const normalizedRole = role?.toLowerCase();
  
  if (normalizedRole !== 'inhaber' && normalizedRole !== 'office' && normalizedRole !== 'admin' && normalizedRole !== 'developer') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Zugriff verweigert</h1>
        <p className="text-text-muted">Sie haben nicht die erforderlichen Rechte (Inhaber/Office), um den Periodenabschluss durchzuführen.</p>
      </div>
    );
  }

  const status = await getPeriodenabschlussStatusAction();
  
  return (
    <Suspense fallback={<div className="p-8">Lade Perioden-Status...</div>}>
      <PeriodenabschlussClient initialStatus={status} userRole={normalizedRole} />
    </Suspense>
  );
}
