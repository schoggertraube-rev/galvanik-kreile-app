// src/lib/warnings/engine.ts
// Kern der Warning Engine — evaluateRule + Cooldown-Check
import type { WarningRule, WarningEvent } from "@/types/warnings";

let idCounter = 0;
function generateId(): string {
  return `we_${Date.now()}_${++idCounter}`;
}

export function isInCooldown(
  rule: WarningRule,
  lastEventAt: string | undefined
): boolean {
  if (!rule.cooldownMinutes || !lastEventAt) return false;
  const elapsedMs = Date.now() - new Date(lastEventAt).getTime();
  return elapsedMs < rule.cooldownMinutes * 60 * 1000;
}

export function evaluateRule(
  rule: WarningRule,
  context: Record<string, unknown>,
  lastEventAt?: string
): WarningEvent | null {
  if (!rule.isActive) return null;
  if (rule.isMutedUntil && new Date(rule.isMutedUntil) > new Date()) return null;
  if (isInCooldown(rule, lastEventAt)) return null;

  // Simple expression evaluation based on context keys
  const triggered = evaluateExpression(rule.expression, context);
  if (!triggered) return null;

  return {
    id: generateId(),
    ruleId: rule.id,
    ruleCode: rule.code,
    domain: rule.domain,
    severity: rule.severity,
    entityType: context.entityType as string | undefined,
    entityId: context.entityId as string | undefined,
    contextData: context,
    message: buildMessage(rule, context),
    proposedAction: rule.proposedAction,
    routeOnClick: rule.routeOnClick,
    detectedAt: new Date().toISOString(),
    acknowledgedAt: null,
    resolvedAt: null,
  };
}

function buildMessage(rule: WarningRule, context: Record<string, unknown>): string {
  let msg = rule.title;
  if (context.entityId) msg += ` (ID: ${context.entityId})`;
  return msg;
}

function evaluateExpression(expression: string, context: Record<string, unknown>): boolean {
  // Simple keyword-based evaluation — no eval() for safety
  try {
    const parts = expression.match(/(\w+)\s*(>|>=|<|<=|===|==)\s*(.+)/);
    if (!parts) return false;
    const [, key, op, rawVal] = parts;
    const contextVal = context[key];
    const compareVal = rawVal === "true" ? true : rawVal === "false" ? false : parseFloat(rawVal);

    if (typeof contextVal === "number" && typeof compareVal === "number") {
      if (op === ">") return contextVal > compareVal;
      if (op === ">=") return contextVal >= compareVal;
      if (op === "<") return contextVal < compareVal;
      if (op === "<=") return contextVal <= compareVal;
    }
    if (op === "===" || op === "==") return contextVal === compareVal;
    return false;
  } catch {
    return false;
  }
}
