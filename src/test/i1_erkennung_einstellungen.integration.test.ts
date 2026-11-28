// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";

const tenant = vi.hoisted(() => "TEST-ablauf-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: tenant }));

import { full, nativeFetch, sql, withSession } from "../../e2e/ablauf/replayHarness";
import {
  confirmIntakeOriginalAction,
  finishIntakeFileAction,
  getIntakeCaptureAction,
  openIntakeOriginalAction,
  prepareIntakeFileAction,
  retryIntakeRecognitionAction,
} from "@/app/actions/eingang.actions";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { EXCEL_WORKBOOK_MIME } from "@/lib/server/azureDocumentIntelligence";
import { createAdminClient } from "@/lib/supabase/admin";
import { readErkennungsEinstellungenInTransaction } from "@/modules/fundament/server-public";

it("reads stored company models and threshold, with the existing default layout", async () => {
  await sql`INSERT INTO public.tenant_features (tenant,feature_id,enabled) VALUES (${tenant},'E04',true)`;
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
    dokument_lesen: true,
    ki_sicherheitsschwelle: 0.5,
    erkennung_modelle: { dokument: "prebuilt-layout", rechnung: null, bon: "test-quittung" },
  });
});

it.each([
  { extension: "xlsx", mime: EXCEL_WORKBOOK_MIME },
  { extension: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { extension: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  { extension: "html", mime: "text/html" },
])("reads a secured $extension with the document model and preserves the original", async ({ extension, mime }) => {
  const name = `TEST_i1_reading.${extension}`;
  const bytes = extension === "html"
    ? Buffer.from("<!doctype html><html lang='de'><head><title>TEST</title></head><body>TEST Office-Dokument 95</body></html>")
    : readFileSync(new URL(`../../e2e/fixtures/${name}`, import.meta.url));
  const itemId = randomUUID();
  const fileId = randomUUID();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const grant = await withSession(full, () => prepareIntakeFileAction({
    itemId, fileId, name, mime,
    bytes: bytes.length, sha256,
  }));
  if (grant.code !== "OK" || !grant.upload) throw Error("TEST_I1_WORKBOOK_GRANT");
  const upload = await createAdminClient().storage.from(grant.upload.bucket).uploadToSignedUrl(
    grant.upload.path, grant.upload.token, bytes, { contentType: mime },
  );
  expect(upload.error).toBeNull();

  vi.stubEnv("AZURE_DOCINTEL_ENDPOINT", "https://i1-workbook.example.invalid/");
  vi.stubEnv("AZURE_DOCINTEL_KEY", "TEST-i1-workbook");
  const requests: { url: URL; body?: BodyInit | null }[] = [];
  const fetched = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "i1-workbook.example.invalid") return nativeFetch(input, init);
    if (init?.method === "POST") {
      requests.push({ url, body: init.body });
      return new Response(null, { status: 202, headers: {
        "operation-location": "https://i1-workbook.example.invalid/documentintelligence/documentModels/prebuilt-layout/analyzeResults/TEST-XLSX",
      } });
    }
    return Response.json({ status: "succeeded", analyzeResult: {
      modelId: "prebuilt-layout", content: "TEST Office-Dokument\n95", pages: [{ pageNumber: 1 }],
    } });
  });
  try {
    await withSession(full, async () => {
      const pending = await finishIntakeFileAction(fileId);
      expect(pending).toMatchObject({ code: "OK", capture: { files: [
        expect.objectContaining({ id: fileId, status: "wartet", secured: true }),
      ] } });
      expect(await finishIntakeFileAction(fileId)).toEqual(pending);
      expect(requests).toHaveLength(0);
    }, true);
    const result = await withSession(full, () => getIntakeCaptureAction(itemId));
    expect(result).toMatchObject({ code: "OK", capture: { files: [expect.objectContaining({
      id: fileId, status: "fertig", secured: true, recognizedText: "TEST Office-Dokument\n95",
    })] } });
    expect(requests).toHaveLength(1);
    expect(requests[0].url.pathname).toBe("/documentintelligence/documentModels/prebuilt-layout:analyze");
    expect(requests[0].url.searchParams.has("features")).toBe(false);
    expect(JSON.parse(String(requests[0].body)).base64Source).toBe(bytes.toString("base64"));
    expect(await sql`SELECT von::text AS actor,nachher FROM public.intake_event
      WHERE tenant_id=${tenant} AND item_id=${itemId}::uuid AND art='erkannt'`).toEqual([{
      actor: full.actorId, nachher: { fileId, kind: "notiz", modelle: ["prebuilt-layout"], code: "OK", textGekuerzt: false },
    }]);

    const opened = await withSession(full, () => openIntakeOriginalAction({ fileId, clientEventId: randomUUID() }));
    if (extension === "xlsx") {
      if (opened.code !== "OK" || !opened.original.downloadUrl) throw Error("TEST_I1_WORKBOOK_ORIGINAL");
      const original = await nativeFetch(opened.original.downloadUrl);
      expect(original.ok).toBe(true);
      expect(Buffer.from(await original.arrayBuffer())).toEqual(bytes);
    } else {
      expect(opened).toMatchObject({ code: "FILE_BLOCKED" });
      const original = await createAdminClient().storage.from(grant.upload.bucket).download(grant.upload.path);
      expect(original.error).toBeNull();
      expect(Buffer.from(await original.data!.arrayBuffer())).toEqual(bytes);
    }
  } finally {
    fetched.mockRestore();
    vi.unstubAllEnvs();
  }
});

it.each([
  { kind: "rechnung", text: "Rechnung\nRechnungsnummer TEST", specialist: null, code: "OK" },
  { kind: "rechnung", text: "Rechnung\nRechnungsnummer TEST", specialist: "test-i1-invoice", code: "OK" },
  { kind: "quittung", text: "Quittung: TEST", specialist: "test-i1-receipt", code: "TEILWEISE" },
])("keeps the first reading with the configured second model ($kind, $specialist)", async ({ kind, text, specialist, code }) => {
  const documentModel = "test-i1-document";
  const settings = { dokument: documentModel, rechnung: kind === "rechnung" ? specialist : null,
    bon: kind === "quittung" ? specialist : null };
  const [previous] = await sql`UPDATE public.company_settings SET erkennung_modelle=${sql.json(settings)}
    WHERE tenant_id=${tenant} RETURNING id`;
  if (!previous) throw Error("TEST_I1_COMPANY_MISSING");
  const itemId = randomUUID(), fileId = randomUUID();
  const bytes = Buffer.concat([Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3l8AAAAASUVORK5CYII=", "base64",
  ), Buffer.from(fileId)]);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const grant = await withSession(full, () => prepareIntakeFileAction({
    itemId, fileId, name: "TEST-Beleg.png", mime: "image/png", bytes: bytes.length, sha256,
  }));
  if (grant.code !== "OK" || !grant.upload) throw Error("TEST_I1_SPECIALIST_UPLOAD");
  const storage = createAdminClient().storage.from(grant.upload.bucket);
  expect((await storage.uploadToSignedUrl(grant.upload.path, grant.upload.token, bytes, { contentType: "image/png" })).error).toBeNull();
  const endpoint = "https://i1-models.example.invalid";
  vi.stubEnv("AZURE_DOCINTEL_ENDPOINT", endpoint);
  vi.stubEnv("AZURE_DOCINTEL_KEY", "TEST-i1-models");
  const calls: string[] = [];
  const fetched = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== endpoint) return nativeFetch(input, init);
    const modelId = /^\/documentintelligence\/documentModels\/([^:/]+)/.exec(url.pathname)?.[1];
    if (init?.method === "POST") {
      if (!modelId) throw Error("TEST_I1_MODEL_REQUEST");
      calls.push(modelId);
      if (modelId === "test-i1-receipt") return new Response(null, { status: 503 });
      return new Response(null, { status: 202, headers: {
        "operation-location": `${endpoint}/documentintelligence/documentModels/${modelId}/analyzeResults/TEST-I1`,
      } });
    }
    return Response.json({ status: "succeeded", analyzeResult: modelId === documentModel
      ? { modelId, content: text, pages: [{ pageNumber: 1 }] }
      : { modelId, pages: [{ pageNumber: 1 }], documents: [{ fields: {
        InvoiceId: { content: "TEST-RE-94", confidence: 0.8, boundingRegions: [{ pageNumber: 1, polygon: [] }] },
      } }] },
    });
  });
  try {
    expect(await withSession(full, () => finishIntakeFileAction(fileId), true)).toMatchObject({ code: "OK" });
    const names = specialist ? [documentModel, specialist] : [documentModel];
    expect(calls).toEqual(names);
    expect(await withSession(full, () => getIntakeCaptureAction(itemId))).toMatchObject({
      code: "OK", capture: { files: [{ id: fileId, status: "fertig", secured: true, recognizedText: text }] },
    });
    expect(await sql`SELECT nachher FROM public.intake_event
      WHERE tenant_id=${tenant} AND item_id=${itemId}::uuid AND art='erkannt'`).toEqual([{
      nachher: { fileId, kind, modelle: names, code, textGekuerzt: false },
    }]);
    if (specialist === "test-i1-invoice") {
      expect(await sql`SELECT wert,modell,fundstelle FROM public.intake_suggestion
        WHERE tenant_id=${tenant} AND file_id=${fileId}::uuid AND feld='rechnung.nummer' AND status='offen'`)
        .toEqual([{ wert: "TEST-RE-94", modell: specialist, fundstelle: { page: 1, polygon: [] } }]);
      expect((await storage.download(`${tenant}/${sha256}.erkennung.${specialist}.json`)).error).toBeNull();
    }
  } finally {
    fetched.mockRestore();
    vi.unstubAllEnvs();
    await sql`UPDATE public.company_settings SET erkennung_modelle='{"dokument":null,"rechnung":null,"bon":"test-quittung"}'::jsonb
      WHERE tenant_id=${tenant}`;
  }
});

it.each([
  { text: "TEST Rechnung", damagedArchive: true, documentModel: null },
  { text: null, damagedArchive: true, documentModel: null },
  { text: null, damagedArchive: false, documentModel: "test-kreile-layout" },
])("stores the original and reads the model setting (text=$text, damagedArchive=$damagedArchive, model=$documentModel)", async ({ text, damagedArchive, documentModel }) => {
  const model = documentModel ?? "prebuilt-layout";
  if (documentModel) await sql`UPDATE public.company_settings
    SET erkennung_modelle=jsonb_set(erkennung_modelle,'{dokument}',to_jsonb(${documentModel}::text)),
        ki_sicherheitsschwelle=0.85
    WHERE tenant_id=${tenant}`;
  const rawReply = JSON.stringify({ status: "succeeded", analyzeResult: {
    modelId: model, content: text, pages: [{ pageNumber: 1 }, { pageNumber: 2 }],
    keyValuePairs: [{ key: { content: "Rechnungsnummer" }, value: { content: "TEST-I1-NUMMER" } }],
    tables: [{ cells: [
      { rowIndex: 0, columnIndex: 0, kind: "columnHeader", content: "Artikelnummer" },
      { rowIndex: 0, columnIndex: 1, kind: "columnHeader", content: "Menge" },
      { rowIndex: 1, columnIndex: 0, content: "TEST-BELEGZEILE", confidence: 0.9 },
      { rowIndex: 1, columnIndex: 1, content: "4,25", confidence: 0.8 },
    ] }, { cells: [
      { rowIndex: 0, columnIndex: 0, kind: "columnHeader", content: "Bank" },
      { rowIndex: 0, columnIndex: 1, kind: "columnHeader", content: "IBAN" },
      { rowIndex: 1, columnIndex: 0, content: "TEST-Bank" },
      { rowIndex: 1, columnIndex: 1, content: "TEST-IBAN" },
    ] }],
  } }, null, 2) + "\n";
  vi.stubEnv("AZURE_DOCINTEL_ENDPOINT", "https://i1.example.invalid/");
  vi.stubEnv("AZURE_DOCINTEL_KEY", "TEST-i1-external-fixture");
  let providerResults = 0;
  const analyzePaths: string[] = [];
  const fetched = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "i1.example.invalid") return nativeFetch(input, init);
    if (init?.method === "POST") {
      analyzePaths.push(url.pathname);
      return new Response(null, { status: 202, headers: {
        "operation-location": "https://i1.example.invalid/documentintelligence/documentModels/" + model + "/analyzeResults/TEST-I1",
      } });
    }
    return new Response(rawReply + " ".repeat(providerResults++));
  });

  try {
    const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3l8AAAAASUVORK5CYII=", "base64",
    );
    const fileId = randomUUID();
    const itemId = randomUUID();
    const bytes = new Uint8Array(Buffer.concat([image, Buffer.from(fileId)]));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const grant = await withSession(full, () => prepareIntakeFileAction({
      itemId, fileId, name: "TEST-i1.png", mime: "image/png", bytes: bytes.length, sha256,
    }));
    if (grant.code !== "OK" || !grant.upload) throw Error("TEST_I1_UPLOAD_GRANT");
    const storage = createAdminClient().storage;
    const saved = await storage.from(grant.upload.bucket).uploadToSignedUrl(
      grant.upload.path, grant.upload.token, bytes, { contentType: "image/png" },
    );
    expect(saved.error).toBeNull();
    // A previously read TEST file before the canonical raw archive existed.
    await sql`UPDATE public.intake_file SET erkannter_text='TEST früherer Volltext'
      WHERE tenant_id=${tenant} AND id=${fileId}`;

    const archive = storage.from(grant.upload.bucket);
    const archivePath = `${tenant}/${sha256}.erkennung.${model}.json`;
    if (damagedArchive) {
      expect((await archive.upload(archivePath, '{', { contentType: "application/json" })).error).toBeNull();
      await sql`UPDATE public.intake_file SET erkennung_roh_pfad=${archivePath}
        WHERE tenant_id=${tenant} AND id=${fileId}::uuid`;
      try {
        expect(await withSession(full, () => finishIntakeFileAction(fileId), true))
          .toMatchObject({ code: "OK", capture: { files: [expect.objectContaining({ id: fileId, status: "wartet", secured: true })] } });
        const failed = await withSession(full, () => getIntakeCaptureAction(itemId));
        if (failed.code !== "OK") throw Error("TEST_I1_CAPTURE_UNAVAILABLE");
        expect(failed.capture.files.find(file => file.id === fileId)).toMatchObject({
          secured: true, status: "fehler", errorCode: "INTAKE_RAW_NOT_SAVED", recognizedText: text ?? "TEST früherer Volltext",
        });
        expect(failed.capture.suggestions).toEqual(expect.arrayContaining([
          expect.objectContaining({ field: "rechnung.nummer", value: "TEST-I1-NUMMER" }),
        ]));
        expect(await sql`SELECT seiten,erkennung_roh_pfad FROM public.intake_file
          WHERE tenant_id=${tenant} AND id=${fileId}::uuid`).toEqual([{ seiten: 2, erkennung_roh_pfad: null }]);
        expect(await sql`SELECT wert->>'positionKey' AS key FROM public.intake_suggestion
          WHERE tenant_id=${tenant} AND file_id=${fileId}::uuid AND feld='position' AND status='offen'`).toEqual([{ key: "p1" }]);
      } finally {
        expect((await archive.remove([archivePath])).error).toBeNull();
      }
    }
    if (damagedArchive) {
      expect(await withSession(full, () => retryIntakeRecognitionAction({ fileId, clientEventId: randomUUID() })))
        .toMatchObject({ code: "OK" });
    } else {
      expect(await withSession(full, () => finishIntakeFileAction(fileId), true)).toMatchObject({ code: "OK" });
    }
    const result = await withSession(full, () => getIntakeCaptureAction(itemId));
    if (result.code !== "OK") throw Error("TEST_I1_RECOGNITION_FAILED");
    expect(result.capture.files.find(file => file.id === fileId)).toMatchObject({
      status: "fertig", recognizedText: text,
    });
    if (text !== null) expect(result.capture.recognition?.text).toBe(text);
    expect(result.capture.recognition?.text).not.toContain("TEST früherer Volltext");
    const retry = { fileId, clientEventId: randomUUID() };
    const reread = await withSession(full, () => retryIntakeRecognitionAction(retry));
    expect(reread).toMatchObject({ code: "OK", capture: { recognition: { text: result.capture.recognition?.text } } });
    expect(await withSession(full, () => retryIntakeRecognitionAction(retry))).toMatchObject({ code: "OK" });
    expect(providerResults).toBe(damagedArchive ? 3 : 2);
    expect(analyzePaths).toEqual(Array(providerResults).fill("/documentintelligence/documentModels/" + model + ":analyze"));

    const [file] = await sql`SELECT erkennung_roh_pfad,erkannter_text,seiten FROM public.intake_file
      WHERE tenant_id=${tenant} AND id=${fileId}::uuid`;
    expect(file).toMatchObject({
      erkennung_roh_pfad: archivePath,
      erkannter_text: text, seiten: 2,
    });
    const original = await storage.from("scans").download(file.erkennung_roh_pfad);
    expect(original.error).toBeNull();
    expect(await original.data!.text()).toBe(rawReply + (damagedArchive ? " " : ""));
    expect(await sql`SELECT id FROM public.intake_suggestion
      WHERE tenant_id=${tenant} AND file_id=${fileId}::uuid AND feld='DOCUMENT_TEXT'`).toEqual([]);
    const positions = await sql`SELECT wert,modell,sicherheit,sicherheit_wert::float8 AS confidence,status FROM public.intake_suggestion
      WHERE tenant_id=${tenant} AND file_id=${fileId}::uuid AND feld='position'`;
    expect(positions).toHaveLength(damagedArchive ? 3 : 2);
    expect(positions.filter(position => position.status === "offen")).toHaveLength(1);
    for (const position of positions) expect(position).toMatchObject({
      wert: { positionKey: "p1", lieferantenArtikelNr: "TEST-BELEGZEILE", menge: "4.25" },
      modell: model, sicherheit: documentModel ? "unsicher" : "sicher", confidence: 0.8,
    });
    expect(await sql`SELECT sicherheit,sicherheit_wert FROM public.intake_suggestion
      WHERE tenant_id=${tenant} AND file_id=${fileId}::uuid AND feld='rechnung.nummer' AND status='offen'`)
      .toEqual([{ sicherheit: "vorschlag", sicherheit_wert: null }]);
    expect(await withSession(full, () => openIntakeOriginalAction({ fileId, clientEventId: randomUUID() })))
      .toMatchObject({ code: "OK" });
    expect(await withSession(full, () => confirmIntakeOriginalAction({ fileId, clientEventId: randomUUID() })))
      .toMatchObject({ code: "OK", count: documentModel ? 1 : 0 });
  } finally {
    fetched.mockRestore();
    vi.unstubAllEnvs();
    if (documentModel) await sql`UPDATE public.company_settings
      SET erkennung_modelle=jsonb_set(erkennung_modelle,'{dokument}','null'::jsonb),
          ki_sicherheitsschwelle=0.5
      WHERE tenant_id=${tenant}`;
  }
});
