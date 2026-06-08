import { getCurrentRole } from "@/lib/auth/roles";
import { CockpitClient } from "./CockpitClient";

export const dynamic = "force-dynamic";

export default async function CockpitPage() {
  const role = await getCurrentRole();
  const normalizedRole = role?.toLowerCase();
  
  if (normalizedRole !== 'inhaber' && normalizedRole !== 'admin' && normalizedRole !== 'developer') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Zugriff verweigert</h1>
        <p className="text-text-muted">Sie haben nicht die erforderlichen Rechte (Inhaber), um das Cockpit aufzurufen.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative flex flex-col bg-bg-app">
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-gray-200 bg-white">
        <h1 className="text-2xl font-black text-navy-900 tracking-tight">Inhaber-Cockpit</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <CockpitClient />
      </div>
    </div>
  );
}
