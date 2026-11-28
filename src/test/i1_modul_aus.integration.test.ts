// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";

const tenant = vi.hoisted(() => "TEST-ablauf-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: tenant }));

import { full, nativeFetch, sql, withSession } from "../../e2e/ablauf/replayHarness";
import { finishIntakeFileAction, getIntakeCaptureAction, prepareIntakeFileAction } from "@/app/actions/eingang.actions";
import { createAdminClient } from "@/lib/supabase/admin";

it("stores scans with document reading off and still reads the original XML", async () => {
  await sql`INSERT INTO public.tenant_features (tenant,feature_id,enabled) VALUES (${tenant},'E04',false)`;
  const endpoint = "https://i1-switch.example.invalid";
  vi.stubEnv("AZURE_DOCINTEL_ENDPOINT", endpoint);
  vi.stubEnv("AZURE_DOCINTEL_KEY", "TEST-i1-switch");
  let providerCalls = 0;
  const fetched = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== endpoint) return nativeFetch(input, init);
    providerCalls++;
    return new Response(null, { status: 503 });
  });
  const cases = [
    { name: "TEST-Scan.png", mime: "image/png", readable: false, code: "AUSGESCHALTET", kind: null,
      bytes: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3l8AAAAASUVORK5CYII=", "base64") },
    { name: "TEST-XRechnung.xml", mime: "application/xml", readable: true, code: "OK", kind: "rechnung",
      bytes: readFileSync(new URL("../../e2e/fixtures/e-rechnung/TEST_xrechnung_ubl.xml", import.meta.url)) },
  ];
  try {
    for (const { name, mime, bytes, readable, code, kind } of cases) {
      const itemId = randomUUID(), fileId = randomUUID();
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const grant = await withSession(full, () => prepareIntakeFileAction({ itemId, fileId, name, mime, bytes: bytes.length, sha256 }));
      if (grant.code !== "OK" || !grant.upload) throw Error("TEST_I1_SWITCH_UPLOAD");
      const storage = createAdminClient().storage.from(grant.upload.bucket);
      expect((await storage.uploadToSignedUrl(grant.upload.path, grant.upload.token, bytes, { contentType: mime })).error).toBeNull();
      expect(await withSession(full, () => finishIntakeFileAction(fileId), true)).toMatchObject({ code: "OK" });
      expect(await withSession(full, () => getIntakeCaptureAction(itemId))).toMatchObject({
        code: "OK", capture: { files: [{ id: fileId, status: "fertig", secured: true, readable }] },
      });
      expect(await sql`SELECT nachher FROM public.intake_event
        WHERE tenant_id=${tenant} AND item_id=${itemId}::uuid AND art='erkannt'`)
        .toEqual([{ nachher: { fileId, kind, modelle: [], code, textGekuerzt: false } }]);
      if (kind === "rechnung") expect(await sql`SELECT wert FROM public.intake_suggestion
        WHERE tenant_id=${tenant} AND file_id=${fileId}::uuid AND feld='rechnung.nummer'`).toEqual([{ wert: "123456XX" }]);
    }
    expect(providerCalls).toBe(0);
  } finally {
    fetched.mockRestore();
    vi.unstubAllEnvs();
  }
});
