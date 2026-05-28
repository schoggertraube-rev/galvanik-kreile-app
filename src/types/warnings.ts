// src/types/warnings.ts
// Warning Engine — Typen für alle proaktiven Warnmeldungen

export type WarningDomain =
  | "login"
  | "upload"
  | "stations"
  | "payment"
  | "data"
  | "performance"
  | "backup"
  | "search"
  | "offline"
  | "privacy"
  | "hardware"
  | "onboarding"
  | "emergency"
  | "customer";

export type WarningSeverity = "info" | "warn" | "critical";

export type WarningTriggerType =
  | "threshold"
  | "anomaly"
  | "pattern"
  | "timeout"
  | "missing_data"
  | "drift"
  | "expiry"
  | "manual";

export type WarningRule = {
  id: string;
  code: string;
  domain: WarningDomain;
  severity: WarningSeverity;
  trigger: WarningTriggerType;
  title: string;
  description?: string;
  expression: string;
  cooldownMinutes?: number;
  proposedAction?: string;
  routeOnClick?: string;
  isActive: boolean;
  isMutedUntil?: string | null;
  requiredFeatureFlag?: string;
  scope?: "global" | "role" | "user";
  createdAt: string;
  updatedAt: string;
};

export type WarningEvent = {
  id: string;
  ruleId: string;
  ruleCode: string;
  domain: WarningDomain;
  severity: WarningSeverity;
  entityType?: string;
  entityId?: string;
  contextData?: Record<string, unknown>;
  message: string;
  proposedAction?: string;
  routeOnClick?: string;
  detectedAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  acknowledgmentNote?: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolution?: "fixed" | "dismissed" | "deferred" | "false_positive";
};

export type WarningSubscription = {
  id: string;
  userId: string;
  domain: WarningDomain | "all";
  minSeverity: WarningSeverity;
  channels: Array<"in_app" | "email" | "sms" | "push">;
  quietHours?: { fromHour: number; toHour: number };
  isActive: boolean;
};
