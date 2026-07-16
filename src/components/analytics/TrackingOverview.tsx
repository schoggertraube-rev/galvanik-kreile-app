"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { getRecentUiEvents } from "@/app/actions/tracking.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RecentUsageEvent = Awaited<ReturnType<typeof getRecentUiEvents>>[number];

function TrackingCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border border-neutral-gray-200 shadow-sm">
      <CardHeader className="border-b border-neutral-gray-100 bg-bg-app-soft/50 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Activity className="h-4 w-4 text-navy-900" />
          Gespeicherte Nutzungsereignisse
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

export function TrackingOverview() {
  const [events, setEvents] = useState<RecentUsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    getRecentUiEvents()
      .then((data) => setEvents(data || []))
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <TrackingCard><p className="text-xs text-text-muted">Lade gespeicherte Nutzungsdaten …</p></TrackingCard>;
  }

  if (unavailable || events.length === 0) {
    return (
      <TrackingCard>
        <p className="text-xs text-text-muted">
          {unavailable
            ? "Nutzungsdaten konnten nicht geladen werden."
            : "In den letzten sieben Tagen wurden keine Ereignisse gespeichert."}
        </p>
      </TrackingCard>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalToday = events.filter((event) => new Date(event.occurredAt) >= today).length;
  const lastActivity = new Date(events[0].occurredAt);
  const frequency = events.reduce<Record<string, number>>((counts, event) => {
    counts[event.eventType] = (counts[event.eventType] || 0) + 1;
    return counts;
  }, {});
  const sortedFrequencies = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
  const maxFrequency = sortedFrequencies[0]?.[1] || 1;

  return (
    <TrackingCard>
      <div className="space-y-4">
        <div className="flex justify-between border-b border-neutral-gray-100 pb-3 text-xs">
          <div>
            <span className="block text-text-muted">Ereignisse heute:</span>
            <span className="text-lg font-bold text-navy-900">{totalToday}</span>
          </div>
          <div className="text-right">
            <span className="block text-text-muted">Letzte Aktivität:</span>
            <span className="font-bold text-navy-900">
              {lastActivity.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="mb-2 text-xs font-bold text-navy-900">Letzte 50 gespeicherte Ereignisse</h4>
          {sortedFrequencies.map(([type, count]) => (
            <div key={type} className="space-y-1">
              <div className="flex justify-between font-mono text-[10px] text-text-muted">
                <span>{type}</span>
                <span>{count}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-gray-100">
                <div className="h-full rounded-full bg-navy-900" style={{ width: `${Math.max(5, count / maxFrequency * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </TrackingCard>
  );
}
