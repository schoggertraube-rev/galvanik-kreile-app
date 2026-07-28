"use client";

import { createContext, useContext, type ReactNode } from "react";

export type EventType = "click" | "route" | "error" | "network" | "dead_click" | "marker";

export interface BaseEvent {
  id: string;
  timestamp: number;
  type: EventType;
}

export interface ClickEvent extends BaseEvent {
  type: "click" | "dead_click";
  tag: string;
  role: string | null;
  text: string;
  x: number;
  y: number;
}

export interface RouteEvent extends BaseEvent {
  type: "route";
  path: string;
  search: string;
}

export interface AppErrorEvent extends BaseEvent {
  type: "error";
  message: string;
  stack?: string;
  source?: string;
}

export interface NetworkEvent extends BaseEvent {
  type: "network";
  url: string;
  method: string;
  status?: number;
  duration: number;
}

export interface MarkerEvent extends BaseEvent {
  type: "marker";
  category: string;
  description: string;
  expected?: string;
  route: string;
  lastClicks: ClickEvent[];
  screenshot?: string;
}

export type TestpilotEvent = ClickEvent | RouteEvent | AppErrorEvent | NetworkEvent | MarkerEvent;

export interface TestpilotSession {
  sessionId: string;
  startTime: number;
  device: { width: number; height: number; userAgent: string };
  events: TestpilotEvent[];
}

interface TestpilotContextValue {
  session: TestpilotSession | null;
  isActive: boolean;
  isRecording: boolean;
  startSession: () => void;
  stopSession: () => void;
  addMarker: (marker: Omit<MarkerEvent, "id" | "timestamp" | "type" | "lastClicks">) => void;
  clearSession: () => void;
  exportSessionJSON: () => void;
  exportSessionMarkdown: () => void;
}

function unavailable(): never {
  throw new Error("NOT_CONFIGURED: Testpilot-Aufzeichnungen benötigen einen serverseitigen Mandanten-, Einwilligungs- und Receipt-Vertrag.");
}

const disabledValue: TestpilotContextValue = {
  session: null,
  isActive: false,
  isRecording: false,
  startSession: unavailable,
  stopSession: () => undefined,
  addMarker: unavailable,
  clearSession: () => undefined,
  exportSessionJSON: unavailable,
  exportSessionMarkdown: unavailable,
};

const TestpilotContext = createContext<TestpilotContextValue>(disabledValue);

export function useTestpilot() {
  return useContext(TestpilotContext);
}

/** Browser-local click/session capture is intentionally absent until W3. */
export function TestpilotProvider({ children, isAdmin: _isAdmin = false }: { children: ReactNode; isAdmin?: boolean }) {
  return <TestpilotContext.Provider value={disabledValue}>{children}</TestpilotContext.Provider>;
}
