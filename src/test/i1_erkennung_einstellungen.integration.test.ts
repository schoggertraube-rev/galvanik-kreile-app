// @vitest-environment node
import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";

const tenant = vi.hoisted(() => "TEST-ablauf-i1-settings-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: tenant }));

import { full, sql, withSession } from "../../e2e/ablauf/replayHarness";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { readErkennungsEinstellungenInTransaction } from "@/modules/fundament/server-public";

it("reads stored company models and threshold, with the existing default layout", async () => {
  await sql`INSERT INTO public.company_settings
    (id,tenant_id,company_name,material_aufschlag_prozent,lager_regelversion,ki_sicherheitsschwelle,erkennung_modelle)
    VALUES (${randomUUID()},${tenant},'TEST I1 Einstellungen',0,'TEST-I1',0.5,
      '{"dokument":null,"rechnung":null,"bon":"test-quittung"}')`;

  const settings = await withSession(full, async () => {
    const auth = await resolveAuthorization();
    if (!auth.ok) throw Error("TEST_I1_AUTH");
    return withPrivilegedTenantTransaction(auth.data, tx => readErkennungsEinstellungenInTransaction(tx, tenant));
  });

  expect(settings).toMatchObject({
    ki_sicherheitsschwelle: 0.5,
    erkennung_modelle: { dokument: "prebuilt-layout", rechnung: null, bon: "test-quittung" },
  });
});
