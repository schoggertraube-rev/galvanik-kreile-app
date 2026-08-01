import { createHmac } from "node:crypto";
import { db } from "@/db";
import { appUsers, uiEventsTable } from "@/db/schema";
import {
  isLoginPin,
  PIN_LOGIN_ROLES,
  POSTGRES_BCRYPT_PATTERN,
} from "@/lib/auth/pinPolicy";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";

const TENANT_ID = "galvanik-kreile";
const FAILURE_EVENT_TYPE = "pin_login_failed";
const RATE_WINDOW_MS = 15 * 60 * 1000;
const USER_SOURCE_FAILURE_LIMIT = 5;
const SOURCE_FAILURE_LIMIT = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VerifiedPinIdentity = {
  id: string;
  tenantId: string;
  role: string;
  displayName: string;
};

export type PinVerificationResult =
  | { ok: true; identity: VerifiedPinIdentity }
  | { ok: false; message: string; retryAfterSeconds?: number };

function firstForwardedAddress(value: string | null): string {
  return value?.split(",", 1)[0]?.trim().slice(0, 128) || "unknown";
}

export function hashPinLoginSource(
  secret: string,
  vercelForwardedFor: string | null,
): string {
  const address = firstForwardedAddress(vercelForwardedFor);

  return createHmac("sha256", secret)
    .update("kreile-pin-login-source-v2\0")
    .update(address)
    .digest("hex");
}

async function getPinLoginSourceHash(): Promise<string> {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error("APP_SESSION_SECRET is required for PIN login throttling");
  }

  const requestHeaders = await headers();
  return hashPinLoginSource(
    secret,
    requestHeaders.get("x-vercel-forwarded-for"),
  );
}

function retryAfterSeconds(events: Array<{ createdAt: Date }>): number {
  const oldestTimestamp = Math.min(
    ...events.map((event) => new Date(event.createdAt).getTime()),
  );
  const remainingMs = oldestTimestamp + RATE_WINDOW_MS - Date.now();
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

function failurePayload(userId: string | null, sourceHash: string) {
  return {
    userId,
    sourceHash,
    attemptedAt: new Date().toISOString(),
  };
}

export async function verifyPinLogin(
  userIdInput: unknown,
  pinInput: unknown,
): Promise<PinVerificationResult> {
  const sourceHash = await getPinLoginSourceHash();
  const userId =
    typeof userIdInput === "string" && UUID_PATTERN.test(userIdInput)
      ? userIdInput.toLowerCase()
      : null;
  const pin = isLoginPin(pinInput) ? pinInput : null;

  return db.transaction(async (tx) => {
    const lockRows = await tx.execute<{ acquired: boolean }>(
      sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${`pin-login:${sourceHash}`}, 0)) AS acquired`,
    );
    if (!lockRows[0]?.acquired) {
      return {
        ok: false,
        message: "Anmeldung wird bereits geprüft. Bitte kurz erneut versuchen.",
        retryAfterSeconds: 1,
      };
    }

    const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
    const recentFailures = await tx
      .select({
        payload: uiEventsTable.payload,
        createdAt: uiEventsTable.createdAt,
      })
      .from(uiEventsTable)
      .where(
        and(
          eq(uiEventsTable.tenantId, TENANT_ID),
          eq(uiEventsTable.eventType, FAILURE_EVENT_TYPE),
          gte(uiEventsTable.createdAt, windowStart),
          sql`${uiEventsTable.payload}->>'sourceHash' = ${sourceHash}`,
        ),
      )
      .orderBy(desc(uiEventsTable.createdAt))
      .limit(SOURCE_FAILURE_LIMIT);

    const userFailures = userId
      ? recentFailures.filter(
          (event) => event.payload?.userId === userId,
        )
      : [];

    const blockingEvents =
      recentFailures.length >= SOURCE_FAILURE_LIMIT
        ? recentFailures
        : userFailures.length >= USER_SOURCE_FAILURE_LIMIT
          ? userFailures
          : null;

    if (blockingEvents) {
      return {
        ok: false,
        message:
          "Zu viele Fehlversuche. Bitte kurz warten oder den Administrator kontaktieren.",
        retryAfterSeconds: retryAfterSeconds(blockingEvents),
      };
    }

    const recordFailure = async () => {
      await tx.insert(uiEventsTable).values({
        tenantId: TENANT_ID,
        eventType: FAILURE_EVENT_TYPE,
        payload: failurePayload(userId, sourceHash),
      });
    };

    if (!userId || !pin) {
      await recordFailure();
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    const [user] = await tx
      .select({
        id: appUsers.id,
        tenantId: appUsers.tenantId,
        role: appUsers.role,
        fullName: appUsers.fullName,
        pinMatches: sql<boolean>`CASE
          WHEN ${appUsers.pinHash} ~ ${POSTGRES_BCRYPT_PATTERN}
            THEN extensions.crypt(${pin}, ${appUsers.pinHash}) = ${appUsers.pinHash}
          WHEN ${appUsers.pinHash} ~ '^[0-9]{4}$'
            THEN ${appUsers.pinHash} = ${pin}
          ELSE false
        END`,
      })
      .from(appUsers)
      .where(
        and(
          eq(appUsers.id, userId),
          eq(appUsers.tenantId, TENANT_ID),
          eq(appUsers.active, true),
          inArray(appUsers.role, [...PIN_LOGIN_ROLES]),
        ),
      )
      .limit(1);

    if (!user?.pinMatches) {
      await recordFailure();
      const nextUserFailureCount = userFailures.length + 1;
      const nextSourceFailureCount = recentFailures.length + 1;

      if (
        nextUserFailureCount >= USER_SOURCE_FAILURE_LIMIT ||
        nextSourceFailureCount >= SOURCE_FAILURE_LIMIT
      ) {
        return {
          ok: false,
          message:
            "Zu viele Fehlversuche. Bitte kurz warten oder den Administrator kontaktieren.",
          retryAfterSeconds: Math.ceil(RATE_WINDOW_MS / 1000),
        };
      }

      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    const displayName = user.fullName?.trim();
    if (!displayName) {
      console.error("verifyPinLogin: user.fullName is empty for userId:", user.id);
      return {
        ok: false,
        message:
          "Kein Anzeigename für diesen Benutzer konfiguriert. Bitte Administrator kontaktieren.",
      };
    }

    return {
      ok: true,
      identity: {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        displayName,
      },
    };
  });
}
