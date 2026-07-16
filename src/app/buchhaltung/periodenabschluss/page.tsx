import { Suspense } from "react";
import { getCurrentRole } from "@/lib/auth/roles";
import { getPeriodenabschlussStatusAction } from "./actions";
import { PeriodenabschlussClient } from "./PeriodenabschlussClient";

export const dynamic = "force-dynamic";

export default async function PeriodenabschlussPage() {
  const role = (await getCurrentRole())?.toLowerCase();
  if (role !== "buero" && role !== "admin" && role !== "developer") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-navy-900">Zugriff verweigert</h1>
        <p className="text-text-muted">Für diese Ansicht ist eine Finanz-Leseberechtigung erforderlich.</p>
      </div>
    );
  }

  const status = await getPeriodenabschlussStatusAction();
  return (
    <Suspense fallback={<div className="p-8">Lade Periodenstatus …</div>}>
      <PeriodenabschlussClient initialStatus={status} userRole={role} />
    </Suspense>
  );
}
