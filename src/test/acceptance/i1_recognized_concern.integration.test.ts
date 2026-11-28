// @vitest-environment node
// Synthetic OCR response at the external edge; real file, session and concern.
import { createHash, randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";

const tenant = vi.hoisted(() => "TEST-ablauf-i1-concern-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: tenant }));

import { full, nativeFetch, sql, withSession } from "../../../e2e/ablauf/replayHarness";
import { finishIntakeFileAction, prepareIntakeFileAction, retryIntakeRecognitionAction } from "@/app/actions/eingang.actions";
import { createAdminClient } from "@/lib/supabase/admin";

it("I1-a binds a saved delivery note to a single open concern", async () => {
  const itemId = randomUUID();
  const fileId = randomUUID();
  const tinyImage = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3l8AAAAASUVORK5CYII=", "base64",
  );
  // A distinct isolated fixture so the existing immutable reply cache cannot reuse another test's response.
  const bytes = new Uint8Array(Buffer.concat([tinyImage, Buffer.from(fileId, "utf8")]));
  vi.stubEnv("AZURE_DOCINTEL_ENDPOINT", "https://i1-delivery-note.example.invalid/");
  vi.stubEnv("AZURE_DOCINTEL_KEY", "TEST-provider-fixture");
  const fetched = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "i1-delivery-note.example.invalid") return nativeFetch(input, init);
    if (init?.method === "POST") return new Response(null, { status: 202, headers: {
      "operation-location": "https://i1-delivery-note.example.invalid/documentintelligence/documentModels/prebuilt-layout/analyzeResults/TEST-DELIVERY-NOTE",
    } });
    return Response.json({ status: "succeeded", analyzeResult: {
      modelId: "prebuilt-layout", content: "Lieferschein 431\nAbsender: TEST-Betrieb", pages: [{ pageNumber: 1 }],
    } });
  });
  try {
    const grant = await withSession(full, () => prepareIntakeFileAction({
      itemId, fileId, name: "TEST-lieferschein.png", mime: "image/png", bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }));
    if (grant.code !== "OK" || !grant.upload) throw Error("TEST_I1_DELIVERY_NOTE_UPLOAD_GRANT");
    const saved = await createAdminClient().storage.from(grant.upload.bucket).uploadToSignedUrl(
      grant.upload.path, grant.upload.token, bytes, { contentType: "image/png" },
    );
    expect(saved.error).toBeNull();

    expect(await withSession(full, () => finishIntakeFileAction(fileId))).toMatchObject({ code: "OK" });
    expect(await withSession(full, () => retryIntakeRecognitionAction({ fileId, clientEventId: randomUUID() })))
      .toMatchObject({ code: "OK" });
    expect(await sql`SELECT anliegen, anliegen_offen FROM public.intake_item
      WHERE tenant_id=${tenant} AND id=${itemId}::uuid`)
      .toEqual([{ anliegen: ["lieferschein"], anliegen_offen: ["lieferschein"] }]);
    expect(await sql`SELECT nachher->>'kind' AS kind FROM public.intake_event
      WHERE tenant_id=${tenant} AND item_id=${itemId}::uuid AND art='erkannt'`)
      .toEqual([{ kind: "lieferschein" }, { kind: "lieferschein" }]);
  } finally {
    fetched.mockRestore();
    vi.unstubAllEnvs();
  }
});
