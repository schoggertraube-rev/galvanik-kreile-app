import Link from "next/link";
import { requireAdminOrDeveloper } from "@/lib/auth/permissions";

export default async function AdminDevicesPage() {
  await requireAdminOrDeveloper();
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6">
      <h1 className="text-2xl font-bold text-navy-900">Geräte & Sessions</h1>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <h2 className="font-bold">Nicht instrumentiert</h2>
        <p className="mt-2 text-sm">Eindeutige Geräte, Sitzungen, Lizenzplätze, Fernsperren und Gerätefreigaben besitzen noch keinen bestätigten Backendvertrag. Es werden keine Demo-Geräte, Zählstände oder Sperrerfolge angezeigt.</p>
      </div>
      <Link href="/admin/analytics" className="inline-block rounded-xl bg-navy-900 px-4 py-2 text-sm font-bold text-white">Zur bestätigten Telemetrie</Link>
    </main>
  );
}
