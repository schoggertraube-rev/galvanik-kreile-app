"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, CheckCircle2, XCircle, FlaskConical, Loader2, Server } from "lucide-react";
import { useEffect, useState } from "react";
import { getSystemStats, runSupabaseWriteTest } from "@/app/actions/systemStats";

type WriteTestResult = {
  success: boolean;
  message: string;
  durationMs: number;
} | null;

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
  const [writeTest, setWriteTest] = useState<WriteTestResult>(null);
  const [testRunning, setTestRunning] = useState(false);

  useEffect(() => {
    getSystemStats().then(setStats);
  }, []);

  const handleWriteTest = async () => {
    setTestRunning(true);
    setWriteTest(null);
    try {
      const result = await runSupabaseWriteTest();
      setWriteTest(result);
    } catch (err) {
      setWriteTest({ success: false, message: String(err), durationMs: 0 });
    } finally {
      setTestRunning(false);
    }
  };

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
                  onClick={handleWriteTest} 
                  disabled={testRunning || !stats.reachable || stats.provider !== 'supabase'}
                  variant="outline"
                  className="w-full sm:w-auto text-xs font-bold"
                >
                  {testRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Prüfe...</> : <><FlaskConical className="w-4 h-4 mr-2"/> Test starten</>}
                </Button>
              </div>

              {writeTest && (
                <div className={`mt-4 p-4 rounded-xl border flex flex-col gap-2 ${writeTest.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    {writeTest.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600"/> : <XCircle className="w-4 h-4 text-danger-red"/>}
                    <span className={`text-sm font-bold ${writeTest.success ? 'text-emerald-800' : 'text-danger-red'}`}>
                      {writeTest.success ? 'Schreibtest erfolgreich' : 'Schreibtest fehlgeschlagen'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap">{writeTest.message}</p>
                  {writeTest.success && <p className="text-[10px] text-emerald-700/70 text-right">Dauer: {writeTest.durationMs}ms</p>}
                </div>
              )}
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}
