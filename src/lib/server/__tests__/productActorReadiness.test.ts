import { describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { readConfiguredProductActorProfiles } from "../../../../scripts/quality/check-product-actor-readiness";
import {
  evaluateProductActorReadinessFixture,
  type ProductActorConfiguration,
  type ProductActorProfileRow,
} from "../productActorReadinessCore";

const ACTORS = {
  rolf: "11111111-1111-4111-8111-111111111111",
  phillip: "22222222-2222-4222-8222-222222222222",
  gregor: "33333333-3333-4333-8333-333333333333",
} as const;

const configuration: ProductActorConfiguration = { ...ACTORS };

function profiles(): ProductActorProfileRow[] {
  return [
    {
      id: ACTORS.rolf,
      tenantId: KREILE_TENANT_SLUG,
      role: "meister",
      active: true,
    },
    {
      id: ACTORS.phillip,
      tenantId: KREILE_TENANT_SLUG,
      role: "werkstatt",
      active: true,
    },
    {
      id: ACTORS.gregor,
      tenantId: KREILE_TENANT_SLUG,
      role: "admin",
      active: true,
    },
  ];
}

function evaluate(
  config: ProductActorConfiguration = configuration,
  rows: ProductActorProfileRow[] = profiles(),
) {
  return evaluateProductActorReadinessFixture({
    configuration: config,
    profiles: rows,
    tenantId: KREILE_TENANT_SLUG,
    supportReference: "synthetic-test-reference",
  });
}

describe("product actor readiness contract", () => {
  it("binds actor UUIDs individually without the broken array serialization", async () => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const sql = ((
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      calls.push({ text: strings.join("?"), values });
      return Promise.resolve([]);
    }) as unknown as Sql;

    await readConfiguredProductActorProfiles(sql, ACTORS);

    expect(calls).toHaveLength(1);
    expect(calls[0].values).toEqual([
      ACTORS.rolf,
      ACTORS.phillip,
      ACTORS.gregor,
    ]);
    expect(calls[0].text).not.toContain("ANY(");
    expect(calls[0].text.match(/::uuid/g)).toHaveLength(3);
  });

  it("fails closed when all actor bindings are missing", () => {
    expect(evaluate({ rolf: undefined, phillip: undefined, gregor: undefined }))
      .toMatchObject({ ok: false, code: "CONFIG_MISSING" });
  });

  it("fails closed when actor bindings are partial", () => {
    expect(evaluate({ rolf: ACTORS.rolf, phillip: undefined, gregor: undefined }))
      .toMatchObject({ ok: false, code: "CONFIG_PARTIAL" });
  });

  it("fails closed when actor bindings are duplicate", () => {
    expect(evaluate({
      rolf: ACTORS.rolf,
      phillip: ACTORS.rolf,
      gregor: ACTORS.gregor,
    })).toMatchObject({ ok: false, code: "CONFIG_DUPLICATE" });
  });

  it("treats differently cased spellings of one UUID as duplicate", () => {
    const mixedCaseActorId = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
    expect(evaluate({
      rolf: mixedCaseActorId,
      phillip: mixedCaseActorId.toLowerCase(),
      gregor: ACTORS.gregor,
    })).toMatchObject({ ok: false, code: "CONFIG_DUPLICATE" });
  });

  it("fails closed when a configured profile row is ambiguous", () => {
    expect(evaluate(configuration, [...profiles(), profiles()[0]]))
      .toMatchObject({ ok: false, code: "PROFILE_AMBIGUOUS" });
  });

  it("fails closed for the wrong tenant", () => {
    const rows = profiles();
    rows[0] = { ...rows[0], tenantId: "other-tenant" };
    expect(evaluate(configuration, rows))
      .toMatchObject({ ok: false, code: "PROFILE_WRONG_TENANT" });
  });

  it("fails closed for the wrong product role", () => {
    const rows = profiles();
    rows[1] = { ...rows[1], role: "meister" };
    expect(evaluate(configuration, rows))
      .toMatchObject({ ok: false, code: "PROFILE_WRONG_ROLE" });
  });

  it("fails closed for an inactive profile", () => {
    const rows = profiles();
    rows[2] = { ...rows[2], active: false };
    expect(evaluate(configuration, rows))
      .toMatchObject({ ok: false, code: "PROFILE_INACTIVE" });
  });

  it("fails closed when a configured actor has no profile row", () => {
    expect(evaluate(configuration, profiles().slice(0, 2)))
      .toMatchObject({ ok: false, code: "PROFILE_NOT_FOUND" });
  });

  it("accepts exactly the three valid product profiles", () => {
    const result = evaluate();
    expect(result).toMatchObject({
      ok: true,
      evidenceScope: "SYNTHETIC_CI_FIXTURE",
      actors: {
        rolf: { key: "rolf", role: "meister", login: "pin" },
        phillip: { key: "phillip", role: "werkstatt", login: "pin" },
        gregor: { key: "gregor", role: "admin", login: "email" },
      },
    });
    expect(result.evidenceScope).not.toBe("PRODUCTION_READINESS");
  });
});
