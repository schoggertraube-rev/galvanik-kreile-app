import {
  getProductIdentityByKey,
  isAppRole,
  type AppRole,
  type ProductIdentity,
  type ProductIdentityKey,
} from "@/lib/auth/authorizationContract";

export const PRODUCT_ACTOR_KEYS = ["rolf", "phillip", "gregor"] as const;

export const PRODUCT_ACTOR_ENVIRONMENT_VARIABLES: Record<
  ProductIdentityKey,
  string
> = {
  rolf: "KREILE_ROLF_APP_USER_ID",
  phillip: "KREILE_PHILLIP_APP_USER_ID",
  gregor: "KREILE_GREGOR_APP_USER_ID",
};

export const PRODUCT_ACTOR_RULES: Record<
  ProductIdentityKey,
  { allowedRoles: readonly AppRole[]; login: "pin" | "email" }
> = {
  rolf: { allowedRoles: ["meister"], login: "pin" },
  phillip: { allowedRoles: ["werkstatt"], login: "pin" },
  gregor: { allowedRoles: ["admin", "developer"], login: "email" },
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProductActorConfiguration = Record<
  ProductIdentityKey,
  string | undefined
>;

export type ValidProductActorConfiguration = Record<
  ProductIdentityKey,
  string
>;

export type ProductActorProfileRow = {
  id: string;
  tenantId: string;
  role: string;
  active: boolean;
};

export type ProductActorConfigurationFailureCode =
  | "CONFIG_MISSING"
  | "CONFIG_PARTIAL"
  | "CONFIG_INVALID"
  | "CONFIG_DUPLICATE";

export type ProductActorReadinessFailureCode =
  | ProductActorConfigurationFailureCode
  | "PROFILE_READ_UNAVAILABLE"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_AMBIGUOUS"
  | "PROFILE_WRONG_TENANT"
  | "PROFILE_WRONG_ROLE"
  | "PROFILE_INACTIVE";

export type ProductActorEvidenceScope =
  | "RUNTIME_REQUEST"
  | "SYNTHETIC_CI_FIXTURE"
  | "PRODUCTION_READINESS";

export type ReadyProductActor = {
  key: ProductIdentityKey;
  actorId: string;
  tenantId: string;
  role: AppRole;
  identity: ProductIdentity;
  login: "pin" | "email";
};

export type ProductActorReadinessResult =
  | {
      ok: true;
      evidenceScope: ProductActorEvidenceScope;
      actors: Record<ProductIdentityKey, ReadyProductActor>;
    }
  | {
      ok: false;
      evidenceScope: ProductActorEvidenceScope;
      code: ProductActorReadinessFailureCode;
      supportReference: string;
    };

export type ProductActorConfigurationResult =
  | { ok: true; actors: ValidProductActorConfiguration }
  | { ok: false; code: ProductActorConfigurationFailureCode };

export function readProductActorConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): ProductActorConfiguration {
  return {
    rolf: environment[PRODUCT_ACTOR_ENVIRONMENT_VARIABLES.rolf],
    phillip: environment[PRODUCT_ACTOR_ENVIRONMENT_VARIABLES.phillip],
    gregor: environment[PRODUCT_ACTOR_ENVIRONMENT_VARIABLES.gregor],
  };
}

export function validateProductActorConfiguration(
  configuration: ProductActorConfiguration,
): ProductActorConfigurationResult {
  const actors: ValidProductActorConfiguration = {
    rolf: configuration.rolf?.trim().toLowerCase() ?? "",
    phillip: configuration.phillip?.trim().toLowerCase() ?? "",
    gregor: configuration.gregor?.trim().toLowerCase() ?? "",
  };
  const configuredCount = Object.values(actors).filter(Boolean).length;

  if (configuredCount === 0) return { ok: false, code: "CONFIG_MISSING" };
  if (configuredCount !== PRODUCT_ACTOR_KEYS.length) {
    return { ok: false, code: "CONFIG_PARTIAL" };
  }
  if (Object.values(actors).some((value) => !UUID_PATTERN.test(value))) {
    return { ok: false, code: "CONFIG_INVALID" };
  }
  if (new Set(Object.values(actors)).size !== PRODUCT_ACTOR_KEYS.length) {
    return { ok: false, code: "CONFIG_DUPLICATE" };
  }

  return { ok: true, actors };
}

function readinessFailure(
  evidenceScope: ProductActorEvidenceScope,
  code: ProductActorReadinessFailureCode,
  supportReference: string,
): Extract<ProductActorReadinessResult, { ok: false }> {
  return { ok: false, evidenceScope, code, supportReference };
}

/**
 * Pure evaluator shared by runtime and gate tooling. The evidence scope is
 * explicit so a synthetic fixture cannot be represented as production proof.
 */
export function evaluateProductActorReadiness(input: {
  configuration: ProductActorConfiguration;
  profiles: readonly ProductActorProfileRow[];
  tenantId: string;
  supportReference: string;
  evidenceScope: ProductActorEvidenceScope;
}): ProductActorReadinessResult {
  const configuration = validateProductActorConfiguration(input.configuration);
  if (!configuration.ok) {
    return readinessFailure(
      input.evidenceScope,
      configuration.code,
      input.supportReference,
    );
  }

  const actors = {} as Record<ProductIdentityKey, ReadyProductActor>;
  for (const key of PRODUCT_ACTOR_KEYS) {
    const actorId = configuration.actors[key];
    const matches = input.profiles.filter((profile) => profile.id === actorId);
    if (matches.length === 0) {
      return readinessFailure(
        input.evidenceScope,
        "PROFILE_NOT_FOUND",
        input.supportReference,
      );
    }
    if (matches.length !== 1) {
      return readinessFailure(
        input.evidenceScope,
        "PROFILE_AMBIGUOUS",
        input.supportReference,
      );
    }

    const profile = matches[0];
    if (profile.tenantId !== input.tenantId) {
      return readinessFailure(
        input.evidenceScope,
        "PROFILE_WRONG_TENANT",
        input.supportReference,
      );
    }
    if (!profile.active) {
      return readinessFailure(
        input.evidenceScope,
        "PROFILE_INACTIVE",
        input.supportReference,
      );
    }
    if (
      !isAppRole(profile.role) ||
      !PRODUCT_ACTOR_RULES[key].allowedRoles.includes(profile.role)
    ) {
      return readinessFailure(
        input.evidenceScope,
        "PROFILE_WRONG_ROLE",
        input.supportReference,
      );
    }

    actors[key] = {
      key,
      actorId,
      tenantId: profile.tenantId,
      role: profile.role,
      identity: getProductIdentityByKey(key),
      login: PRODUCT_ACTOR_RULES[key].login,
    };
  }

  return {
    ok: true,
    evidenceScope: input.evidenceScope,
    actors,
  };
}

/** Contract-only evidence. This result is never production readiness. */
export function evaluateProductActorReadinessFixture(input: {
  configuration: ProductActorConfiguration;
  profiles: readonly ProductActorProfileRow[];
  tenantId: string;
  supportReference?: string;
}): ProductActorReadinessResult {
  return evaluateProductActorReadiness({
    ...input,
    supportReference: input.supportReference ?? "synthetic-fixture",
    evidenceScope: "SYNTHETIC_CI_FIXTURE",
  });
}
