"use client";
// src/lib/warnings/hooks.ts
import { useState, useEffect } from "react";
import { warningStore } from "./store";
import type { WarningEvent, WarningDomain } from "@/types/warnings";

export function useWarnings(domain?: WarningDomain) {
  const [events, setEvents] = useState<WarningEvent[]>([]);

  useEffect(() => {
    const update = () => {
      const active = warningStore.getActive();
      setEvents(domain ? active.filter((e) => e.domain === domain) : active);
    };
    update();
    return warningStore.subscribe(update);
  }, [domain]);

  const criticalCount = events.filter((e) => e.severity === "critical").length;
  const warnCount = events.filter((e) => e.severity === "warn").length;

  return {
    events,
    criticalCount,
    warnCount,
    totalCount: events.length,
    acknowledge: (id: string, by = "user") => warningStore.acknowledge(id, by),
    resolve: (id: string, resolution: WarningEvent["resolution"]) =>
      warningStore.resolve(id, "user", resolution),
  };
}

export function useWarningBell() {
  const { events, criticalCount, totalCount } = useWarnings();
  const highestSeverity = criticalCount > 0 ? "critical" : events.some(e => e.severity === "warn") ? "warn" : "info";
  return { totalCount, highestSeverity };
}
