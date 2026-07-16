import type { AppRole } from "@/lib/auth/authorizationContract";
import {
  consumeDurableRateLimit,
  readRateLimitInteger,
  resetDurableRateLimit,
} from "@/lib/server/durableRateLimit";

const NAMESPACE = "pin-login";
export const PIN_LOGIN_PUBLIC_RETRY_SECONDS = 1;

function subjectFor(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`;
}

export function getPinLoginAttemptPolicy(role: AppRole): {
  limit: number;
  windowSeconds: number;
} {
  const standardLimit = readRateLimitInteger(
    "PIN_LOGIN_ATTEMPT_LIMIT",
    5,
    2,
    20,
  );
  const adminLimit = readRateLimitInteger(
    "PIN_LOGIN_ADMIN_ATTEMPT_LIMIT",
    Math.min(3, standardLimit),
    2,
    standardLimit,
  );
  return {
    limit: role === "admin" ? adminLimit : standardLimit,
    windowSeconds: readRateLimitInteger(
      "PIN_LOGIN_ATTEMPT_WINDOW_SECONDS",
      15 * 60,
      60,
      24 * 60 * 60,
    ),
  };
}

export async function reservePinLoginAttempt(input: {
  tenantId: string;
  userId: string;
  role: AppRole;
}) {
  const policy = getPinLoginAttemptPolicy(input.role);
  return consumeDurableRateLimit({
    namespace: NAMESPACE,
    subject: subjectFor(input.tenantId, input.userId),
    actorId: input.userId,
    limit: policy.limit,
    windowSeconds: policy.windowSeconds,
    metadata: { tenantId: input.tenantId, role: input.role },
  });
}

export async function resetPinLoginAttempts(input: {
  tenantId: string;
  userId: string;
  role: AppRole;
}): Promise<void> {
  await resetDurableRateLimit({
    namespace: NAMESPACE,
    subject: subjectFor(input.tenantId, input.userId),
    actorId: input.userId,
    metadata: { tenantId: input.tenantId, role: input.role },
  });
}
