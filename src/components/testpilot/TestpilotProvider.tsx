"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { createId } from '@paralleldrive/cuid2';

export type EventType = 'click' | 'route' | 'error' | 'network' | 'dead_click' | 'marker';

export interface BaseEvent {
  id: string;
  timestamp: number;
  type: EventType;
}

export interface ClickEvent extends BaseEvent {
  type: 'click' | 'dead_click';
  tag: string;
  role: string | null;
  text: string;
  x: number;
  y: number;
}

export interface RouteEvent extends BaseEvent {
  type: 'route';
  path: string;
  search: string;
}

export interface AppErrorEvent extends BaseEvent {
  type: 'error';
  message: string;
  stack?: string;
  source?: string;
}

export interface NetworkEvent extends BaseEvent {
  type: 'network';
  url: string;
  method: string;
  status?: number;
  duration: number;
}

export interface MarkerEvent extends BaseEvent {
  type: 'marker';
  category: string;
  description: string;
  expected?: string;
  route: string;
  lastClicks: ClickEvent[];
}

export type TestpilotEvent = ClickEvent | RouteEvent | AppErrorEvent | NetworkEvent | MarkerEvent;

export interface TestpilotSession {
  sessionId: string;
  startTime: number;
  device: {
    width: number;
    height: number;
    userAgent: string;
  };
  events: TestpilotEvent[];
}

export type AddEventPayload = 
  | Omit<ClickEvent, 'id' | 'timestamp'>
  | Omit<RouteEvent, 'id' | 'timestamp'>
  | Omit<AppErrorEvent, 'id' | 'timestamp'>
  | Omit<NetworkEvent, 'id' | 'timestamp'>
  | Omit<MarkerEvent, 'id' | 'timestamp'>;

interface TestpilotContextValue {
  session: TestpilotSession | null;
  isActive: boolean;
  isRecording: boolean;
  startSession: () => void;
  stopSession: () => void;
  addMarker: (marker: Omit<MarkerEvent, 'id' | 'timestamp' | 'type' | 'lastClicks'>) => void;
  clearSession: () => void;
  exportSessionJSON: () => void;
  exportSessionMarkdown: () => void;
}

const TestpilotContext = createContext<TestpilotContextValue | null>(null);

export function useTestpilot() {
  const ctx = useContext(TestpilotContext);
  if (!ctx) throw new Error("useTestpilot must be used within TestpilotProvider");
  return ctx;
}

function RouteTracker({ isActive, isRecording, addEvent }: { isActive: boolean; isRecording: boolean; addEvent: (event: AddEventPayload) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isActive && isRecording && pathname) {
      addEvent({
        type: 'route',
        path: pathname,
        search: searchParams?.toString() || ''
      });
    }
  }, [pathname, searchParams, isActive, isRecording, addEvent]);

  return null;
}

export function TestpilotProvider({ children, isAdmin = false }: { children: React.ReactNode, isAdmin?: boolean }) {
  const [isActive, setIsActive] = useState(false);
  const [session, setSession] = useState<TestpilotSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const eventsRef = useRef<TestpilotEvent[]>([]);
  const lastClickRef = useRef<{ time: number, element: HTMLElement | null }>({ time: 0, element: null });

  // Initialize from localStorage and env vars
  useEffect(() => {
    const initTimer = setTimeout(() => {
      // 1. Role Check
      if (!isAdmin) return;

      // 2. Env Var Check
      const envEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_ANALYTICS === 'true';
      if (!envEnabled) return;
      
      // 3. Local Developer Switch
      const localEnabled = localStorage.getItem('testpilot_enabled') === 'true';
      if (!localEnabled) return;

      setIsActive(true);

      const stored = localStorage.getItem('testpilot_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 hours
          if (Date.now() - parsed.startTime > SESSION_TTL) {
            console.log("[Testpilot] Session expired, clearing local storage.");
            localStorage.removeItem('testpilot_session');
          } else {
            setSession(parsed);
            eventsRef.current = parsed.events || [];
            setIsRecording(true);
          }
        } catch (e) {
          console.error("Failed to parse testpilot session", e);
          localStorage.removeItem('testpilot_session');
        }
      }
    }, 0);
    
    return () => clearTimeout(initTimer);
  }, [isAdmin]);

  const saveToStorage = useCallback((newSession: TestpilotSession) => {
    setSession(newSession);
    localStorage.setItem('testpilot_session', JSON.stringify(newSession));
  }, []);

  const addEvent = useCallback((event: AddEventPayload) => {
    if (!isRecording) return;
    const newEvent = {
      ...event,
      id: createId(),
      timestamp: Date.now()
    } as TestpilotEvent;
    
    eventsRef.current = [...eventsRef.current, newEvent];
    
    setSession(prev => {
      if (!prev) return prev;
      const updated = { ...prev, events: eventsRef.current };
      localStorage.setItem('testpilot_session', JSON.stringify(updated));
      return updated;
    });
  }, [isRecording]);

  const startSession = useCallback(() => {
    const newSession: TestpilotSession = {
      sessionId: createId(),
      startTime: Date.now(),
      device: {
        width: window.innerWidth,
        height: window.innerHeight,
        userAgent: window.navigator.userAgent,
      },
      events: []
    };
    eventsRef.current = [];
    saveToStorage(newSession);
    setIsRecording(true);
  }, [saveToStorage]);

  const stopSession = useCallback(() => {
    setIsRecording(false);
    // Keep it in local storage so it can be exported, or clear? We keep it.
  }, []);

  const clearSession = useCallback(() => {
    setIsRecording(false);
    setSession(null);
    eventsRef.current = [];
    localStorage.removeItem('testpilot_session');
  }, []);

  // Track Clicks & Dead Clicks
  useEffect(() => {
    if (!isActive || !isRecording) return;
    
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Filter out sensitive data from text, mask it here if needed
      // Simple masking: only grab short text, avoid long paragraphs
      let text = target.innerText?.slice(0, 100).trim() || '';
      
      // Obfuscate potentially sensitive data (numbers, emails)
      text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
      text = text.replace(/\b\d+\b/g, '[NUM]');
      // Further obfuscate passwords if any input fields are clicked (inputs usually don't have innerText, but just in case)
      if (target.tagName.toLowerCase() === 'input' && (target as HTMLInputElement).type === 'password') {
        text = '***';
      }

      // Avoid logging our own testpilot UI
      if (target.closest('[data-testpilot-ignore="true"]')) return;

      lastClickRef.current = { time: Date.now(), element: target };

      addEvent({
        type: 'click',
        tag: target.tagName.toLowerCase(),
        role: target.getAttribute('role') || null,
        text: text.trim(),
        x: e.clientX,
        y: e.clientY,
      });

      // Dead click detection: check if URL or DOM changed significantly after 2s
      setTimeout(() => {
        if (!isRecording) return;
        const clickTime = lastClickRef.current.time;
        if (Date.now() - clickTime > 1900 && lastClickRef.current.element === target) {
          // If no other click happened, and we are still here, it might be a dead click if nothing happened.
          // This is a naive heuristic.
          const lastEvents = eventsRef.current.slice(-5);
          const hasRouteOrNetwork = lastEvents.some(ev => ev.timestamp > clickTime && (ev.type === 'route' || ev.type === 'network'));
          if (!hasRouteOrNetwork) {
             addEvent({
                type: 'dead_click',
                tag: target.tagName.toLowerCase(),
                role: target.getAttribute('role') || null,
                text: text.trim(),
                x: e.clientX,
                y: e.clientY,
             });
          }
        }
      }, 2000);
    };

    window.addEventListener('click', handleClick, true);
    return () => window.removeEventListener('click', handleClick, true);
  }, [isActive, isRecording, addEvent]);

  // Track Errors
  useEffect(() => {
    if (!isActive || !isRecording) return;

    const handleError = (e: ErrorEvent) => {
      addEvent({
        type: 'error',
        message: e.message,
        stack: e.error?.stack,
        source: e.filename,
      });
    };

    const handleRejection = (e: PromiseRejectionEvent) => {
      addEvent({
        type: 'error',
        message: e.reason?.message || String(e.reason),
        stack: e.reason?.stack,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [isActive, isRecording, addEvent]);

  // Monkey-patch fetch (basic)
  useEffect(() => {
    if (!isActive || !isRecording) return;
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const start = Date.now();
      const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : 'unknown');
      const method = (args[1]?.method) || (args[0] instanceof Request ? args[0].method : 'GET');
      
      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - start;
        if (!response.ok || duration > 1000) {
          addEvent({
            type: 'network',
            url,
            method,
            status: response.status,
            duration
          });
        }
        return response;
      } catch (err) {
        addEvent({
          type: 'network',
          url,
          method,
          status: 0,
          duration: Date.now() - start
        });
        throw err;
      }
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [isActive, isRecording, addEvent]);

  const addMarker = useCallback((marker: Omit<MarkerEvent, 'id' | 'timestamp' | 'type' | 'lastClicks'>) => {
    const lastClicks = eventsRef.current.filter(e => e.type === 'click' || e.type === 'dead_click').slice(-5) as ClickEvent[];
    addEvent({
      ...marker,
      type: 'marker',
      lastClicks
    });
  }, [addEvent]);

  const exportSessionJSON = useCallback(() => {
    if (!session) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `testpilot-session-${session.sessionId}.json`);
    dlAnchorElem.click();
  }, [session]);

  const exportSessionMarkdown = useCallback(() => {
    if (!session) return;
    
    const lines = [
      `# Kreile Testanalyse Report`,
      ``,
      `## Kontext`,
      `- Datum: ${new Date(session.startTime).toLocaleString()}`,
      `- Session: ${session.sessionId}`,
      `- Gerät: ${session.device.userAgent}`,
      `- Viewport: ${session.device.width}x${session.device.height}`,
      ``,
      `## Automatischer Verlauf`
    ];

    session.events.forEach((e, i) => {
      const time = new Date(e.timestamp).toLocaleTimeString();
      if (e.type === 'route') {
        lines.push(`${i+1}. [${time}] Route: ${e.path}${e.search ? `?${e.search}` : ''}`);
      } else if (e.type === 'click') {
        lines.push(`${i+1}. [${time}] Klick: <${e.tag}> "${e.text}"`);
      } else if (e.type === 'dead_click') {
        lines.push(`${i+1}. [${time}] DEAD KLICK Verdacht: <${e.tag}> "${e.text}"`);
      } else if (e.type === 'error') {
        lines.push(`${i+1}. [${time}] FEHLER: ${e.message}`);
      } else if (e.type === 'network') {
        lines.push(`${i+1}. [${time}] NETZWERK: ${e.method} ${e.url} (${e.status}) in ${e.duration}ms`);
      } else if (e.type === 'marker') {
        lines.push(`${i+1}. [${time}] MARKER: [${e.category}] ${e.description}`);
      }
    });

    lines.push(`\n## Vorschlag für Antigravity`);
    lines.push(`Bitte prüfe die betroffene Route und behebe den Fehler minimal-invasiv. Keine komplette Seite ersetzen. Bestehende Struktur erhalten. Nach Änderung tsc, build, tests und Route-Proof ausführen.`);

    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(lines.join('\n'));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `testpilot-report-${session.sessionId}.md`);
    dlAnchorElem.click();

  }, [session]);

  const contextValue = {
    session,
    isActive,
    isRecording,
    startSession,
    stopSession,
    addMarker,
    clearSession,
    exportSessionJSON,
    exportSessionMarkdown
  };

  return (
    <TestpilotContext.Provider value={contextValue}>
      {children}
      <React.Suspense fallback={null}>
        <RouteTracker isActive={isActive} isRecording={isRecording} addEvent={addEvent} />
      </React.Suspense>
    </TestpilotContext.Provider>
  );
}
