import "server-only";

import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import {
  resolveAuthorization,
  type AuthorizationFailureReason,
  type AuthorizationSnapshot,
} from "@/lib/server/authorization";
import {
  PRODUCT_ACTOR_KEYS,
  evaluateProductActorReadiness,
  readProductActorConfiguration,
  validateProductActorConfiguration,
  type ProductActorReadinessFailureCode,
  type ProductActorReadinessResult,
  type ProductActorProfileRow,
  type ReadyProductActor,
} from "@/lib/server/productActorReadinessCore";

export type {
  ProductActorConfiguration,
  ProductActorEvidenceScope,
  ProductActorProfileRow,
  ProductActorReadinessFailureCode,
  ProductActorReadinessResult,
  ReadyProductActor,
} from "@/lib/server/productActorReadinessCore";
export { evaluateProductActorReadinessFixture } from "@/lib/server/productActorReadinessCore";

export type ProductActorAuthorizationFailureReason =
  | AuthorizationFailureReason
  | "ACTOR_READINESS_UNAVAILABLE"
  | "SESSION_ACTOR_NOT_CONFIGURED"
  | "SESSION_ACTOR_ROLE_MISMATCH";

export type ProductActorAuthorizationResult =
  | {
      ok: true;
      data: {
        authorization: AuthorizationSnapshot;
        actor: ReadyProductActor;
      };
    }
  | {
      ok: false;
      reason: ProductActorAuthorizationFailureReason;
      message: string;
      supportReference?: string;
    };

export type ProductActorOperationalFailureCode =
  | "PIN_LOGIN_SURFACE_UNAVAILABLE"
  | "EMAIL_LOGIN_IDENTITY_MISMATCH"
  | "PRODUCTION_READINESS_UNAVAILABLE";

function reportRuntimeFailure(result: Extract<ProductActorReadinessResult, { ok: false }>): void {
  console.error(JSON.stringify({
    event: "PRODUCT_ACTOR_READINESS_FAILED",
    status: "FAIL",
    evidenceScope: result.evidenceScope,
    code: result.code,
    supportReference: result.supportReference,
  }));
}

function runtimeFailure(
  code: ProductActorReadinessFailureCode,
  supportReference = randomUUID(),
): Extract<ProductActorReadinessResult, { ok: false }> {
  const result = {
    ok: false,
    evidenceScope: "RUNTIME_REQUEST",
    code,
    supportReference,
  } as const;
  reportRuntimeFailure(result);
  return result;
}

function reportAuthorizationFailure(
  reason: ProductActorAuthorizationFailureReason,
): string {
  const supportReference = randomUUID();
  console.error(JSON.stringify({
    event: "PRODUCT_ACTOR_AUTHORIZATION_FAILED",
    status: "FAIL",
    reason,
    supportReference,
  }));
  return supportReference;
}

export function reportProductActorOperationalFailure(
  code: ProductActorOperationalFailureCode,
): string {
  const supportReference = randomUUID();
  console.error(JSON.stringify({
    event: "PRODUCT_ACTOR_OPERATIONAL_FAILURE",
    status: "FAIL",
    code,
    supportReference,
  }));
  return supportReference;
}

/** Server-only readiness from the current runtime configuration and database. */
export async function readProductActorReadiness(): Promise<ProductActorReadinessResult> {
  const supportReference = randomUUID();
  const configuration = readProductActorConfiguration(process.env);
  const validated = validateProductActorConfiguration(configuration);
  if (!validated.ok) {
    return runtimeFailure(validated.code, supportReference);
  }

  let profiles: ProductActorProfileRow[];
  try {
    profiles = await db
      .select({
        id: appUsers.id,
        tenantId: appUsers.tenantId,
        role: appUsers.role,
        active: appUsers.active,
      })
      .from(appUsers)
      .where(inArray(appUsers.id, Object.values(validated.actors)));
  } catch {
    return runtimeFailure("PROFILE_READ_UNAVAILABLE", supportReference);
  }

  const result = evaluateProductActorReadiness({
    configuration,
    profiles,
    tenantId: KREILE_TENANT_SLUG,
    supportReference,
    evidenceScope: "RUNTIME_REQUEST",
  });
  if (!result.ok) reportRuntimeFailure(result);
  return result;
}

/**
 * One routing/bootstrap choke point: session actor, DB authorization and the
 * complete three-profile readiness contract must agree.
 */
export async function resolveProductActorAuthorization(): Promise<ProductActorAuthorizationResult> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    if (
      authorization.reason === "NO_SESSION" ||
      authorization.reason === "INVALID_SESSION"
    ) {
      return authorization;
    }
    return {
      ...authorization,
      supportReference: reportAuthorizationFailure(authorization.reason),
    };
  }

  const readiness = await readProductActorReadiness();
  if (!readiness.ok) {
    return {
      ok: false,
      reason: "ACTOR_READINESS_UNAVAILABLE",
      message: "Produktprofile sind momentan nicht sicher verfügbar.",
      supportReference: readiness.supportReference,
    };
  }

  const actor = PRODUCT_ACTOR_KEYS
    .map((key) => readiness.actors[key])
    .find((candidate) => candidate.actorId === authorization.data.userId);
  if (!actor) {
    const supportReference = reportAuthorizationFailure(
      "SESSION_ACTOR_NOT_CONFIGURED",
    );
    return {
      ok: false,
      reason: "SESSION_ACTOR_NOT_CONFIGURED",
      message: "Dieses Produktprofil ist für die aktuelle Sitzung nicht freigegeben.",
      supportReference,
    };
  }
  if (actor.role !== authorization.data.role) {
    const supportReference = reportAuthorizationFailure(
      "SESSION_ACTOR_ROLE_MISMATCH",
    );
    return {
      ok: false,
      reason: "SESSION_ACTOR_ROLE_MISMATCH",
      message: "Die Rollenfreigabe der aktuellen Sitzung ist nicht mehr gültig.",
      supportReference,
    };
  }

  return {
    ok: true,
    data: {
      authorization: {
        ...authorization.data,
        displayName: actor.identity.name,
      },
      actor,
    },
  };
}
