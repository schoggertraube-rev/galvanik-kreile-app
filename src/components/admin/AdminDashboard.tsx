"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, FlaskConical, Server } from "lucide-react";
import { useEffect, useState } from "react";
import { getSystemStats } from "@/app/actions/systemStats";

export function AdminDashboard() {
  const [stats, setStats] = useState<{
    provider: string;
    supabaseHost: string;
    reachable: boolean;
    orders: number;
    customers: number;
    users: number;
    lastCheck: string;
    lastError: string | null;
  } | null>(null);

  useEffect(() => {
    getSystemStats().then(setStats);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5"/> System Status & Diagnose</CardTitle>
        <CardDescription>Technische Informationen zur App-Umgebung und Datenbank</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!stats ? (
          <div className="animate-pulse text-sm text-text-muted">Lade Diagnose-Daten...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Datenquelle */}
              <div className="p-4 rounded-xl border border-neutral-gray-100 bg-bg-app-soft">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Datenquelle</p>
                <div className="flex items-center gap-2">
                  {stats.provider === 'supabase' ? (
                    <span className="font-mono text-sm font-bold text-navy-900 bg-gold-100 px-2 py-0.5 rounded">SUPABASE</span>
                  ) : (
                    <span className="font-mono text-sm font-bold text-navy-900 bg-neutral-gray-200 px-2 py-0.5 rounded">LOKAL / DEMO</span>
                  )}
                </div>
              </div>

              {/* Verbindung */}
              <div className="p-4 rounded-xl border border-neutral-gray-100 bg-bg-app-soft">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Verbindung</p>
                <div className="flex items-center gap-2">
                  {stats.reachable ? (
                    <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-sm font-bold text-emerald-700">Online & Erreichbar</span></>
                  ) : (
                    <><XCircle className="w-4 h-4 text-danger-red" /><span className="text-sm font-bold text-danger-red">Offline / Nicht erreichbar</span></>
                  )}
                </div>
              </div>
              
              {/* Supabase URL */}
              <div className="p-4 rounded-xl border border-neutral-gray-100 bg-bg-app-soft md:col-span-2">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Supabase Host</p>
                <p className="font-mono text-xs text-navy-700 truncate">{stats.supabaseHost || 'Nicht konfiguriert'}</p>
              </div>

              {/* Count: Aufträge */}
              <div className="p-4 rounded-xl border border-neutral-gray-100 bg-bg-app-soft">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Aufträge</p>
                <p className="text-xl font-black text-navy-900">{stats.orders}</p>
              </div>
              
              {/* Count: Kunden */}
              <div className="p-4 rounded-xl border border-neutral-gray-100 bg-bg-app-soft">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Kunden</p>
                <p className="text-xl font-black text-navy-900">{stats.customers}</p>
              </div>

              {/* Count: Benutzer */}
              <div className="p-4 rounded-xl border border-neutral-gray-100 bg-bg-app-soft md:col-span-2">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Registrierte Benutzer (App)</p>
                <p className="text-xl font-black text-navy-900">{stats.users}</p>
              </div>
            </div>

            {stats.lastError && (
              <div className="p-4 rounded-xl border border-danger-red/30 bg-accent-orange-soft/30 text-danger-red text-sm font-mono whitespace-pre-wrap break-all">
                <strong>Letzter Fehler:</strong><br/>
                {stats.lastError}
              </div>
            )}
            
            <p className="text-[10px] text-text-muted text-right">Letzter Check: {stats.lastCheck}</p>

            {/* Write Test Area */}
            <div className="pt-4 border-t border-neutral-gray-100">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-navy-900">Datenbank Schreib-Test</p>
                  <p className="text-xs text-text-muted">Prüft, ob RLS-Policies und Schreibrechte korrekt konfiguriert sind (Schreibt ein leeres UI-Event).</p>
                </div>
                <Button 
                  disabled
                  variant="outline"
                  className="w-full sm:w-auto text-xs font-bold"
                >
                  <><FlaskConical className="w-4 h-4 mr-2"/> Test starten (NOT_AVAILABLE)</>
                </Button>
              </div>
              <p className="mt-3 text-xs text-danger-red">
                NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.
              </p>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}
