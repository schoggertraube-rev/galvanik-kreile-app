"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, User, Bell, Factory, Database, CheckCircle2, XCircle, FlaskConical, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useEffect, useState } from "react";
import { getSystemStats, runSupabaseWriteTest } from "@/app/actions/systemStats";

type WriteTestResult = {
  success: boolean;
  message: string;
  durationMs: number;
} | null;

export default function SettingsPage() {
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
    <div className="space-y-6 pb-12 font-sans antialiased text-navy-900 max-w-4xl mx-auto">
      <div className="bg-gold-100 border-l-4 border-gold-600 p-4 rounded-r-md">
        <div className="flex">
          <div className="shrink-0">
            <AlertCircle className="h-5 w-5 text-gold-600" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-gold-600 font-medium">
              Einstellungen sind in Vorbereitung. Inhalte werden mit der Datenbank-Anbindung freigeschaltet.
            </p>
          </div>
        </div>
      </div>

      <PageHeader
        title="Einstellungen"
        subtitle="Verwalte dein Profil und die Werkstatt-Konfiguration."
      />

      <div className="space-y-6">
        
        {/* System Diagnostics Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5"/> System Status & Diagnose</CardTitle>
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
                    <p className="text-[10px] text-text-muted mt-1">Letzter Check: {new Date(stats.lastCheck).toLocaleTimeString()}</p>
                  </div>

                  {/* Supabase Host */}
                  <div className="p-4 rounded-xl border border-neutral-gray-100 bg-bg-app-soft">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Supabase Host</p>
                    <p className="font-mono text-xs text-navy-900 break-all">{stats.supabaseHost || '(nicht konfiguriert)'}</p>
                  </div>

                  {/* Letzter Fehler */}
                  <div className="p-4 rounded-xl border border-neutral-gray-100 bg-bg-app-soft">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Letzter Fehler</p>
                    {stats.lastError ? (
                      <p className="text-xs text-danger-red font-mono break-all">{stats.lastError.slice(0, 200)}</p>
                    ) : (
                      <p className="text-xs text-emerald-700 font-bold">Kein Fehler</p>
                    )}
                  </div>
                </div>

                {/* Counts */}
                {stats.provider === 'supabase' && stats.reachable && (
                  <div className="p-4 rounded-xl border border-neutral-gray-100 bg-bg-app-soft grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Aufträge</p>
                      <p className="text-xl font-black text-navy-900">{stats.orders}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Kunden</p>
                      <p className="text-xl font-black text-navy-900">{stats.customers}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Benutzer</p>
                      <p className="text-xl font-black text-navy-900">{stats.users}</p>
                    </div>
                  </div>
                )}

                {/* Write Test */}
                {stats.provider === 'supabase' && (
                  <div className="p-4 rounded-xl border border-neutral-gray-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-navy-900 uppercase tracking-wider">Supabase Schreibtest</p>
                        <p className="text-[10px] text-text-muted mt-0.5">Legt einen Testkunden an, liest ihn zurück und löscht ihn sofort wieder.</p>
                      </div>
                      <Button 
                        onClick={handleWriteTest} 
                        disabled={testRunning}
                        className="bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs h-9 px-4"
                      >
                        {testRunning ? (
                          <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Teste...</>
                        ) : (
                          <><FlaskConical className="w-3.5 h-3.5 mr-2" /> Schreibtest starten</>
                        )}
                      </Button>
                    </div>
                    {writeTest && (
                      <div className={`p-3 rounded-lg text-xs font-mono ${writeTest.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                        <div className="flex items-start gap-2">
                          {writeTest.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-danger-red shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="font-bold">{writeTest.success ? 'Erfolgreich' : 'Fehlgeschlagen'}</p>
                            <p className="mt-1 break-all">{writeTest.message}</p>
                            <p className="text-[10px] mt-1 opacity-70">Dauer: {writeTest.durationMs}ms</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="opacity-60 pointer-events-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5"/> Mein Profil</CardTitle>
            <CardDescription>Persönliche Daten und Login-Optionen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <input disabled type="text" className="w-full border rounded-md p-2 bg-bg-app-soft" placeholder="Max Mustermann" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">E-Mail</label>
              <input disabled type="text" className="w-full border rounded-md p-2 bg-bg-app-soft" placeholder="max@kreile.local" />
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-60 pointer-events-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5"/> Benachrichtigungen</CardTitle>
            <CardDescription>Welche Benachrichtigungen möchtest du erhalten?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input type="checkbox" disabled checked className="rounded text-navy-900" />
              <label className="text-sm font-medium">E-Mail bei kritischen Aufträgen</label>
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" disabled className="rounded text-navy-900" />
              <label className="text-sm font-medium">Tägliche Zusammenfassung</label>
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-60 pointer-events-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Factory className="h-5 w-5"/> Werkstattdaten</CardTitle>
            <CardDescription>Allgemeine Konfiguration für die Stationen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Stundensatz (Standard) in €</label>
              <input disabled type="text" className="w-full border rounded-md p-2 bg-bg-app-soft" placeholder="75.00" />
            </div>
            <Button disabled>Speichern</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
