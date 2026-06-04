"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTestpilot, TestpilotSession } from '@/components/testpilot/TestpilotProvider';

export default function TestanalyseDashboard() {
  const { session, exportSessionJSON, exportSessionMarkdown } = useTestpilot();
  const [mounted, setMounted] = useState(false);
  const [localSession, setLocalSession] = useState<TestpilotSession | null>(null);
  const [isLocalEnabled, setIsLocalEnabled] = useState(false);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      setMounted(true);
      setIsLocalEnabled(localStorage.getItem('testpilot_enabled') === 'true');
      const stored = sessionStorage.getItem('testpilot_session');
      if (stored) {
        try {
          setLocalSession(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse testpilot session on dashboard", e);
        }
      }
    }, 0);
    return () => clearTimeout(initTimer);
  }, [session]); // Reload if current active session updates

  const displaySession = session || localSession;

  const toggleLocalEnabled = () => {
    const newValue = !isLocalEnabled;
    setIsLocalEnabled(newValue);
    if (newValue) {
      localStorage.setItem('testpilot_enabled', 'true');
    } else {
      localStorage.removeItem('testpilot_enabled');
    }
    // Forces a hard reload so the provider picks up the new status across the app
    window.location.reload();
  };

  if (!mounted) return null;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 text-slate-900 dark:text-slate-100">
      <header className="flex justify-between items-end border-b pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-bold font-playfair">Testanalyse Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Auswertung von Testpilot-Sessions und Fehlern.</p>
        </div>
        <div className="flex gap-4 items-center">
          <button
            onClick={toggleLocalEnabled}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              isLocalEnabled 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 border border-green-200 dark:border-green-800' 
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {isLocalEnabled ? 'Testmodus: AKTIV' : 'Testmodus: INAKTIV'}
          </button>
          <Link 
            href="/admin/testanalyse/live"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm"
          >
            Neue Live-Session
          </Link>
        </div>
      </header>

      {displaySession ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border dark:border-slate-800">
            <h2 className="text-xl font-semibold mb-4">Aktuelle/Letzte Session</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="block text-slate-500">Session ID</span>
                <span className="font-mono">{displaySession.sessionId}</span>
              </div>
              <div>
                <span className="block text-slate-500">Startzeit</span>
                <span>{new Date(displaySession.startTime).toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-slate-500">Gerät</span>
                <span>{displaySession.device.width}x{displaySession.device.height}</span>
              </div>
              <div>
                <span className="block text-slate-500">Events</span>
                <span>{displaySession.events.length}</span>
              </div>
            </div>
            
            <div className="mt-6 flex gap-3">
              <button 
                onClick={exportSessionMarkdown}
                className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                Als Markdown exportieren
              </button>
              <button 
                onClick={exportSessionJSON}
                className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                Als JSON exportieren
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border dark:border-slate-800">
            <h2 className="text-xl font-semibold mb-4">Event-Protokoll</h2>
            <div className="space-y-3">
              {displaySession.events.slice().reverse().map((ev, i) => (
                <div key={ev.id || i} className="p-3 border rounded-md dark:border-slate-700 text-sm flex gap-4">
                  <div className="text-slate-500 w-24 shrink-0">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="font-semibold w-24 shrink-0 capitalize">
                    {ev.type}
                  </div>
                  <div className="flex-1">
                    {ev.type === 'route' && <span>Pfad: {ev.path}{ev.search ? `?${ev.search}` : ''}</span>}
                    {ev.type === 'click' && <span>Klick auf &lt;{ev.tag}&gt; &quot;{ev.text}&quot;</span>}
                    {ev.type === 'dead_click' && <span className="text-orange-500 font-medium">Toter Klick auf &lt;{ev.tag}&gt; &quot;{ev.text}&quot;</span>}
                    {ev.type === 'error' && <span className="text-red-500 font-medium">{ev.message}</span>}
                    {ev.type === 'network' && <span>{ev.method} {ev.url} ({ev.status}) - {ev.duration}ms</span>}
                    {ev.type === 'marker' && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md mt-1 border border-blue-100 dark:border-blue-800">
                        <span className="font-bold block mb-1">[{ev.category}]</span>
                        <p>{ev.description}</p>
                        {ev.expected && <p className="text-slate-500 mt-1">Erwartet: {ev.expected}</p>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-slate-500">
          Keine Testsession gefunden. Starte eine Live-Session, um Daten zu sammeln.
        </div>
      )}
    </div>
  );
}
