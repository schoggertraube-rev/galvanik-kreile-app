"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { getRecentUiEvents } from "@/app/actions/tracking.actions";

export function TrackingOverview() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentUiEvents().then(data => {
      setEvents(data || []);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Card className="border border-neutral-gray-200 shadow-sm">
        <CardHeader className="bg-bg-app-soft/50 border-b border-neutral-gray-100 py-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Activity className="w-4 h-4 text-navy-900" />
            Live Tracking (Proof of Life)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-xs text-text-muted">Lade Tracking-Daten...</p>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="border border-neutral-gray-200 shadow-sm">
        <CardHeader className="bg-bg-app-soft/50 border-b border-neutral-gray-100 py-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Activity className="w-4 h-4 text-navy-900" />
            Live Tracking (Proof of Life)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-xs text-text-muted">Keine Events gefunden.</p>
        </CardContent>
      </Card>
    );
  }

  // 2. Gesamtanzahl heute
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalToday = events.filter(e => new Date(e.createdAt) >= today).length;
  const lastActivity = new Date(events[0].createdAt);

  // 3. Häufigkeit für "Balkendiagramm"
  const frequency: Record<string, number> = {};
  for (const event of events) {
    frequency[event.eventType] = (frequency[event.eventType] || 0) + 1;
  }

  // Sortieren für Anzeige
  const sortedFrequencies = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
  const maxFreq = sortedFrequencies[0]?.[1] || 1;

  return (
    <Card className="border border-neutral-gray-200 shadow-sm">
      <CardHeader className="bg-bg-app-soft/50 border-b border-neutral-gray-100 py-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Activity className="w-4 h-4 text-navy-900" />
          Live Tracking (Proof of Life)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between text-xs border-b border-neutral-gray-100 pb-3">
          <div>
            <span className="text-text-muted block">Events Heute:</span>
            <span className="font-bold text-navy-900 text-lg">{totalToday}</span>
          </div>
          <div className="text-right">
            <span className="text-text-muted block">Letzte Aktivität:</span>
            <span className="font-bold text-navy-900">
              {lastActivity.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold text-navy-900 mb-2">Letzte 50 Events (Verteilung)</h4>
          {sortedFrequencies.map(([type, count]) => {
            const width = Math.max(5, (count / maxFreq) * 100);
            return (
              <div key={type} className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-text-muted">
                  <span>{type}</span>
                  <span>{count}</span>
                </div>
                <div className="w-full bg-neutral-gray-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-navy-900 h-full rounded-full" 
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
