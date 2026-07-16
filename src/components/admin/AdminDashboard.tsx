"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Server, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSystemStats, type SystemStats } from "@/app/actions/systemStats";

export function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    let active = true;
    getSystemStats().then((result) => {
      if (active) setStats(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> Systemstatus & Diagnose</CardTitle>
        <CardDescription>Tenantgebundene technische Informationen zur App-Umgebung und Datenbank</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!stats ? (
          <div className="animate-pulse text-sm text-text-muted">Diagnosedaten werden geladen …</div>
        ) : (
          <>
            {stats.lastError && (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {stats.lastError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <StatCard label="Datenquelle" value={stats.provider} />
              <div className="rounded-xl border border-neutral-gray-100 bg-bg-app-soft p-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-text-muted">Verbindung</p>
                {stats.reachable === true ? (
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Erreichbar</div>
                ) : stats.reachable === false ? (
                  <div className="flex items-center gap-2 text-sm font-bold text-danger-red"><XCircle className="h-4 w-4" /> Nicht erreichbar</div>
                ) : (
                  <p className="text-sm font-bold text-text-muted">—</p>
                )}
              </div>
              <StatCard label="Supabase Host" value={stats.supabaseHost || "—"} wide />
              <StatCard label="Aufträge" value={stats.orders ?? "—"} />
              <StatCard label="Kunden" value={stats.customers ?? "—"} />
              <StatCard label="Registrierte App-Benutzer" value={stats.users ?? "—"} wide />
            </div>

            <div className="rounded-xl border border-neutral-gray-200 bg-bg-app-soft p-4">
              <p className="text-sm font-bold text-navy-900">Mutierender Datenbanktest gesperrt</p>
              <p className="mt-1 text-xs text-text-muted">Insert/Read/Delete wird nicht ausgeführt, solange kein freigegebener tenantgebundener Idempotenz- und Auditvertrag existiert. Es werden keine Testkundendaten angelegt oder gelöscht.</p>
            </div>

            <p className="text-right text-[10px] text-text-muted">Letzter Check: {stats.lastCheck}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, wide = false }: { label: string; value: string | number; wide?: boolean }) {
  return (
    <div className={"rounded-xl border border-neutral-gray-100 bg-bg-app-soft p-4" + (wide ? " md:col-span-2" : "")}>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-text-muted">{label}</p>
      <p className="break-all font-mono text-sm font-bold text-navy-900">{value}</p>
    </div>
  );
}
