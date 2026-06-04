"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

/* ===== Types ===== */
export type DiagEventType =
  | "error"        // JS/Console error
  | "network"      // Failed fetch/XHR
  | "interaction"  // User clicks/taps
  | "navigation"   // Route changes
  | "manual"       // User-flagged problem
  | "performance"  // Slow renders / long tasks
  | "info";        // General info

export interface DiagEvent {
  id: string;
  timestamp: string;
  type: DiagEventType;
  severity: "info" | "warn" | "error" | "critical";
  source: string;       // Component/page/action name
  message: string;
  details?: string;      // Stack trace, request URL, etc.
  route?: string;        // Current pathname
  viewport?: string;     // e.g. "1024x768"
  userAgent?: string;
}

interface DiagContextValue {
  isActive: boolean;
  events: DiagEvent[];
  activate: () => void;
  deactivate: () => void;
  toggle: () => void;
  logEvent: (event: Omit<DiagEvent, "id" | "timestamp" | "route" | "viewport" | "userAgent">) => void;
  markProblem: (description: string) => void;
  clearEvents: () => void;
  exportReport: () => string;
  eventCount: { errors: number; warnings: number; total: number };
}

const DiagContext = createContext<DiagContextValue | null>(null);

export function useDiagnostics() {
  const ctx = useContext(DiagContext);
  if (!ctx) {
    // Return a no-op version when not wrapped in provider (safe fallback)
    return {
      isActive: false,
      events: [],
      activate: () => {},
      deactivate: () => {},
      toggle: () => {},
      logEvent: () => {},
      markProblem: () => {},
      clearEvents: () => {},
      exportReport: () => "",
      eventCount: { errors: 0, warnings: 0, total: 0 },
    } as DiagContextValue;
  }
  return ctx;
}

/* ===== Provider ===== */
export function DiagnosticsProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [events, setEvents] = useState<DiagEvent[]>([]);
  const eventsRef = useRef<DiagEvent[]>([]);

  // Keep ref in sync
  useEffect(() => { eventsRef.current = events; }, [events]);

  const makeId = () => `diag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const getContext = useCallback(() => ({
    route: typeof window !== "undefined" ? window.location.pathname : "/",
    viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "unknown",
    userAgent: typeof window !== "undefined" ? navigator.userAgent : "unknown",
  }), []);

  const logEvent = useCallback((event: Omit<DiagEvent, "id" | "timestamp" | "route" | "viewport" | "userAgent">) => {
    const full: DiagEvent = {
      ...event,
      id: makeId(),
      timestamp: new Date().toISOString(),
      ...getContext(),
    };
    setEvents(prev => [...prev.slice(-499), full]); // Cap at 500 events
  }, [getContext]);

  const markProblem = useCallback((description: string) => {
    logEvent({
      type: "manual",
      severity: "error",
      source: "user",
      message: description,
      details: `Manuell markiert auf ${window.location.pathname}`,
    });
  }, [logEvent]);

  const clearEvents = useCallback(() => { setEvents([]); }, []);

  const activate = useCallback(() => {
    setIsActive(true);
    logEvent({
      type: "info",
      severity: "info",
      source: "diagnostics",
      message: "Testanalyse aktiviert",
    });
  }, [logEvent]);

  const deactivate = useCallback(() => {
    setIsActive(false);
    logEvent({
      type: "info",
      severity: "info",
      source: "diagnostics",
      message: "Testanalyse deaktiviert",
    });
  }, [logEvent]);

  const toggle = useCallback(() => {
    if (isActive) deactivate();
    else activate();
  }, [isActive, activate, deactivate]);

  const exportReport = useCallback(() => {
    const errors = eventsRef.current.filter(e => e.severity === "error" || e.severity === "critical");
    const warnings = eventsRef.current.filter(e => e.severity === "warn");
    const manual = eventsRef.current.filter(e => e.type === "manual");

    const lines: string[] = [
      `# Testbericht — ${new Date().toLocaleString("de-DE")}`,
      ``,
      `## Zusammenfassung`,
      `- Gesamt: ${eventsRef.current.length} Ereignisse`,
      `- Fehler: ${errors.length}`,
      `- Warnungen: ${warnings.length}`,
      `- Manuell markiert: ${manual.length}`,
      `- Viewport: ${getContext().viewport}`,
      `- User-Agent: ${getContext().userAgent}`,
      ``,
    ];

    if (errors.length > 0) {
      lines.push(`## ❌ Fehler`);
      errors.forEach(e => {
        lines.push(`### ${e.timestamp} · ${e.source}`);
        lines.push(`${e.message}`);
        if (e.details) lines.push(`\`\`\`\n${e.details}\n\`\`\``);
        if (e.route) lines.push(`Route: ${e.route}`);
        lines.push(``);
      });
    }

    if (manual.length > 0) {
      lines.push(`## 🚩 Manuell markierte Probleme`);
      manual.forEach(e => {
        lines.push(`- **${e.timestamp}** (${e.route}): ${e.message}`);
      });
      lines.push(``);
    }

    if (warnings.length > 0) {
      lines.push(`## ⚠️ Warnungen`);
      warnings.forEach(e => {
        lines.push(`- ${e.timestamp} · ${e.source}: ${e.message}`);
      });
      lines.push(``);
    }

    lines.push(`## 📋 Vollständiges Log`);
    lines.push(`\`\`\`json`);
    lines.push(JSON.stringify(eventsRef.current, null, 2));
    lines.push(`\`\`\``);

    return lines.join("\n");
  }, [getContext]);

  // ===== GLOBAL ERROR INTERCEPTORS (only when active) =====
  useEffect(() => {
    if (!isActive || typeof window === "undefined") return;

    // 1. Console.error interception
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      origError(...args);
      const msg = args.map(a => typeof a === "string" ? a : (a instanceof Error ? a.message : JSON.stringify(a))).join(" ");
      logEvent({
        type: "error",
        severity: "error",
        source: "console.error",
        message: msg.slice(0, 500),
        details: args.find(a => a instanceof Error)?.stack || undefined,
      } as Omit<DiagEvent, "id" | "timestamp" | "route" | "viewport" | "userAgent">);
    };

    // 2. Unhandled errors
    const handleError = (event: ErrorEvent) => {
      logEvent({
        type: "error",
        severity: "critical",
        source: "window.onerror",
        message: event.message,
        details: `${event.filename}:${event.lineno}:${event.colno}\n${event.error?.stack || ""}`,
      });
    };

    // 3. Unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      logEvent({
        type: "error",
        severity: "critical",
        source: "unhandledrejection",
        message: reason?.message || String(reason).slice(0, 500),
        details: reason?.stack || undefined,
      });
    };

    // 4. Network errors (fetch interception)
    // Removed to prevent React Suspense / Next.js internal fetch infinite loops

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      console.error = origError;
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [isActive, logEvent]);

  // ===== Persist to localStorage =====
  useEffect(() => {
    if (!isActive || events.length === 0) return;
    try {
      localStorage.setItem("kreile_diag_events", JSON.stringify(events.slice(-200)));
    } catch { /* quota exceeded — ignore */ }
  }, [events, isActive]);

  // ===== Restore on mount =====
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kreile_diag_events");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setTimeout(() => setEvents(parsed), 0);
        }
      }
      const wasActive = localStorage.getItem("kreile_diag_active");
      if (wasActive === "true") {
        setTimeout(() => setIsActive(true), 0);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("kreile_diag_active", String(isActive));
    } catch { /* ignore */ }
  }, [isActive]);

  const eventCount = {
    errors: events.filter(e => e.severity === "error" || e.severity === "critical").length,
    warnings: events.filter(e => e.severity === "warn").length,
    total: events.length,
  };

  return (
    <DiagContext.Provider value={{ isActive, events, activate, deactivate, toggle, logEvent, markProblem, clearEvents, exportReport, eventCount }}>
      {children}
    </DiagContext.Provider>
  );
}
