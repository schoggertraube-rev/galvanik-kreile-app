// @vitest-environment node
import { expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const tenant = vi.hoisted(() => "TEST-ablauf-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: tenant }));
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { sql, full, withSession, nativeFetch } from "../../../e2e/ablauf/replayHarness";
import { customerFixture, intakeOrderFixture } from "../../../e2e/ablauf/orderFixture";

const fresh = <T>(input: T): T => JSON.parse(JSON.stringify(input));

it.each(["automatisch", "bestaetigt"] as const)("L-M3 keeps the incoming assignment decision on retry (%s)", async assignment => {
  const customerId = await customerFixture(`TEST L-M3 ${assignment}`);
  const sourceId = randomUUID();
  // Synthetic settings and assignment for an isolated tenant. Use the actual booking and sender below.
  await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,material_aufschlag_prozent,lager_regelversion)
    SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST L-M3 Eingangsbestätigung',20,'TEST-L-M3'
    WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
  await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,zuordnung,text)
    VALUES(${sourceId}::uuid,${KREILE_TENANT_SLUG},${`TEST L-M3 ${sourceId}`},'mail','rein','mailabruf',
      ${full.actorId}::uuid,${customerId},${assignment},'TEST eingegangene Bestellung')`;
  const { updateCustomerAction } = await import("@/app/actions/customers.actions");
  expect(await withSession(full, () => updateCustomerAction({ customerId, clientEventId: randomUUID(), autoInfo: true })))
    .toMatchObject({ code: "OK" });

  let sends = 0;
  const graph = vi.spyOn(globalThis, "fetch").mockImplementation(async (request, init) => {
    const url = new URL(typeof request === "string" ? request : request instanceof URL ? request.href : request.url);
    if (url.hostname === "login.microsoftonline.com") {
      return Response.json({ access_token: "TEST-LM3-token".repeat(4), expires_in: 3600 });
    }
    if (url.hostname === "graph.microsoft.com" && url.pathname.endsWith("/sendMail")) {
      sends++;
      return new Response(null, { status: 202 });
    }
    return nativeFetch(request, init);
  });
  try {
    const { erfasseAuftragAusEingangAction } = await import("@/app/actions/eingang.actions");
    const input = {
      clientKey: randomUUID(), geprueft: false, text: "TEST bestätigter Auftrag aus E-Mail",
      customer: { mode: "EXISTING" as const, customerId }, dueDate: "2027-05-15", termStatus: "bestaetigt",
      intakeSource: "anfrage_mail", handoverMode: "pickup", paymentMode: "rechnung",
      sourceCaptures: [{ id: sourceId, version: 1 }],
      items: [{
        catalogServiceId: null, name: "TEST L-M3 Teil", quantity: 1, material: "Messing",
        surfaceRequested: "Verchromen", executionRequested: "offen", unit: "Stück",
        unitPriceCents: null, vatRateBasisPoints: null,
      }],
    };
    const result = await withSession(full, () => erfasseAuftragAusEingangAction(input), true);
    if (result.code !== "OK") throw Error(`TEST_LM3_BOOKING:${result.code}:${result.message}`);
    expect(result.intakeItemId).toBe(sourceId);
    const outbox = await sql`SELECT status FROM public.outbox_mails WHERE tenant_id=${KREILE_TENANT_SLUG} AND objekt=${result.orderId}`;
    const expectedSends = assignment === "bestaetigt" ? 1 : 0;
    expect(outbox).toEqual(expectedSends ? [{ status: "gesendet" }] : []);
    expect(await withSession(full, () => erfasseAuftragAusEingangAction(fresh(input)), true))
      .toMatchObject({ code: "OK", orderId: result.orderId, replayed: true });
    expect(sends).toBe(expectedSends);
  } finally {
    graph.mockRestore();
  }
});

it("L-M3 changes handover only after a person assigns the saved mail", async () => {
  const customerId = await customerFixture("L-M3 Abholung");
  const order = await intakeOrderFixture("L-M3 Abholung", customerId, "shipping");
  const [customer] = await sql`SELECT email FROM public.customers
    WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`;
  const itemId = randomUUID();
  const fileId = randomUUID();
  const digest = "e".repeat(64);
  // Isolated original-mail fixture; assignment, order change and replay use their real commands.
  await sql`INSERT INTO public.intake_item(
    id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,zuordnung,einsatz,
    text,anliegen,anliegen_offen,absender_adresse,graph_message_id,empfangen_am
  ) VALUES (
    ${itemId}::uuid,${KREILE_TENANT_SLUG},${itemId},'mail','rein','mailabruf',${full.actorId}::uuid,
    ${customerId},'automatisch','offen','Hole ich ab.',ARRAY['abholung'],ARRAY['abholung'],
    ${customer.email},${`TEST-LM3-${itemId}`},statement_timestamp()
  )`;
  await sql`INSERT INTO public.intake_file(
    id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,
    aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,geoeffnet,erkennung_status
  ) VALUES (
    ${fileId}::uuid,${KREILE_TENANT_SLUG},${itemId}::uuid,${fileId},'mime','TEST L-M3.eml','message/rfc822',
    32,${digest},${`${KREILE_TENANT_SLUG}/${digest}`},now(),${full.actorId}::uuid,1,true,false,'fertig'
  )`;
  const sourceEvents = [
    ["original_gespeichert", { fileId, sha256: digest, bytes: 32 }],
    ["einsatz", { action: "mail_import_complete", fileIds: [fileId] }],
  ] as const;
  for (const [art, detail] of sourceEvents) {
    await sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
      VALUES(${KREILE_TENANT_SLUG},${itemId}::uuid,${art},${randomUUID()}::uuid,
        ${full.actorId}::uuid,${sql.json(detail)})`;
  }

  const { changeOrderPickupNoticeAction } = await import("@/app/actions/orders.actions");
  const { assignIntakeCustomerAction } = await import("@/app/actions/eingang.actions");
  const input = {
    command: "handover_from_mail", sourceItemId: itemId, sourceVersion: 1, clientEventId: randomUUID(),
    orderId: order.receipt.orderId, expectedVersion: order.receipt.orderVersion,
  };
  expect(await withSession(full, () => changeOrderPickupNoticeAction(input))).toMatchObject({
    code: "VALIDATION_ERROR", message: "Eine gespeicherte zugeordnete Original-Mail ist erforderlich.",
  });
  expect(await sql`SELECT handover_mode FROM public.orders
    WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.receipt.orderId}`).toEqual([{ handover_mode: "shipping" }]);
  const assigned = await withSession(full, () => assignIntakeCustomerAction({
    itemId, customerId, version: input.sourceVersion, clientEventId: randomUUID(), mode: "move",
  }));
  if (assigned.code !== "OK") throw Error(`TEST_LM3_ASSIGNMENT:${assigned.code}`);
  const confirmed = { ...input, sourceVersion: assigned.version };
  const changed = await withSession(full, () => changeOrderPickupNoticeAction(confirmed));
  expect(changed, JSON.stringify(changed)).toMatchObject({
    code: "OK", replayed: false, receipt: { handoverMode: "pickup", outcome: "changed" },
  });
  expect(await withSession(full, () => changeOrderPickupNoticeAction(fresh(confirmed)))).toMatchObject({
    code: "OK", replayed: true, receipt: { handoverMode: "pickup" },
  });
});

it("L-M3 keeps the order draft out until its original mail is assigned", async () => {
  const customerId = await customerFixture("L-M3 Entwurf");
  const itemId = randomUUID();
  const id = randomUUID();
  const clientEventId = randomUUID();
  // Isolated initial candidate. Assignment, draft write, readback and retry use the actual commands.
  await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,zuordnung,text)
    VALUES(${itemId}::uuid,${KREILE_TENANT_SLUG},${itemId},'mail','rein','mailabruf',
      ${full.actorId}::uuid,${customerId},'automatisch','TEST Original für Auftragsentwurf')`;
  const { assignIntakeCustomerAction, getIntakeDraftsAction, saveIntakeDraftAction } =
    await import("@/app/actions/eingang.actions");
  const save = {
    id, clientEventId, art: "eingang", lastField: null, expectedVersion: null,
    payload: { clientKey: id, customerId, documents: [itemId], items: [{ name: "TEST Teil", quantity: "3" }] },
  };
  const blocked = await withSession(full, () => saveIntakeDraftAction(save));
  expect(blocked).toMatchObject({ code: "CONFLICT" });
  expect(await sql`SELECT id FROM private.intake_drafts WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${id}::uuid`)
    .toHaveLength(0);
  expect(await withSession(full, () => assignIntakeCustomerAction({
    itemId, customerId, version: 1, clientEventId: randomUUID(), mode: "move",
  }))).toMatchObject({ code: "OK" });

  const saved = await withSession(full, () => saveIntakeDraftAction(fresh(save)));
  expect(saved, JSON.stringify(saved)).toMatchObject({ code: "OK" });
  const expected = { code: "OK", drafts: expect.arrayContaining([expect.objectContaining({ id, payload: save.payload })]) };
  expect(await withSession(full, () => getIntakeDraftsAction())).toMatchObject(expected);
  expect(await withSession(full, () => saveIntakeDraftAction(fresh(save)))).toMatchObject(expected);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}
    AND event_type='INTAKE_DRAFT_SAVED_V1' AND client_event_id=${clientEventId}::uuid`).toHaveLength(1);
});

it("L-M3 binds a thread only to the original MIME and the saved outgoing mail", async () => {
  const customerId = await customerFixture("L-M3 Mailfaden");
  const order = await intakeOrderFixture("L-M3 Mailfaden", customerId);
  const [customer] = await sql`SELECT email FROM public.customers
    WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`;
  const requestId = randomUUID();
  const graphId = "TEST-reply-" + randomUUID();
  const originalId = `<TEST-outgoing-${requestId}@example.invalid>`;
  const incomingId = `<${graphId}@example.invalid>`;
  const sender = customer.email;
  const receivedAt = "2026-11-26T20:02:00.000Z";
  const mime = [
    `From: TEST Kunde <${sender}>`, `To: ${process.env.MS_GRAPH_MAILBOX}`,
    `Message-ID: ${incomingId}`, `In-Reply-To: ${originalId}`, `References: ${originalId}`,
    "Subject: TEST Antwort", "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8",
    "", "Danke für Ihre Nachricht.", "",
  ].join("\r\n");
  let sentRequest = requestId;
  const graph = vi.spyOn(globalThis, "fetch").mockImplementation(async (request, init) => {
    const url = new URL(typeof request === "string" ? request : request instanceof URL ? request.href : request.url);
    if (url.hostname === "login.microsoftonline.com") {
      return Response.json({ access_token: "TEST-LM3-thread-token".repeat(4), expires_in: 3600 });
    }
    if (url.hostname !== "graph.microsoft.com") return nativeFetch(request, init);
    if (url.pathname.endsWith("/sendMail")) return new Response(null, { status: 202 });
    if (url.pathname.includes("/mailFolders/sentitems/messages")) {
      return Response.json({ value: [{
        id: "TEST-sent-thread", internetMessageId: originalId,
        from: { emailAddress: { address: process.env.MS_GRAPH_MAILBOX } },
        toRecipients: [{ emailAddress: { address: sender } }],
        isDraft: false, sentDateTime: "2026-11-26T20:00:00.000Z",
        internetMessageHeaders: [{ name: "x-kreile-request-id", value: sentRequest }],
      }] });
    }
    if (url.pathname.endsWith("/$value")) return new Response(mime);
    if (url.pathname.endsWith("/attachments")) return Response.json({ value: [] });
    return Response.json({
      id: graphId, internetMessageId: incomingId, subject: "TEST Antwort",
      from: { emailAddress: { address: sender, name: "TEST Kunde" } },
      receivedDateTime: receivedAt, bodyPreview: "Danke für Ihre Nachricht.",
      body: { contentType: "text", content: "Danke für Ihre Nachricht." }, hasAttachments: false,
    });
  });

  try {
    const { sendCustomerMailAction, importOutlookMailAction } = await import("@/app/actions/communications.actions");
    const sent = await withSession(full, () => sendCustomerMailAction({
      targetType: "ORDER", targetId: order.receipt.orderId, clientRequestId: requestId,
      subject: "TEST Mailfaden", body: "TEST M3 Ausgangsoriginal",
    }));
    if (sent.code !== "OK") throw Error(`TEST_LM3_SENT:${sent.code}`);
    const imported = await withSession(full, () => importOutlookMailAction(graphId, { deferDispatchReply: true }));
    if (imported.code !== "OK") throw Error(`TEST_LM3_IMPORT:${imported.code}`);
    const { readSavedMailReplyTarget } = await import("@/lib/server/dispatchResponsePort");
    const { resolveAuthorization } = await import("@/lib/server/authorization");
    const read = () => withSession(full, async () => {
      const auth = await resolveAuthorization();
      if (!auth.ok) throw Error("TEST_LM3_SESSION");
      return readSavedMailReplyTarget(auth.data, imported.itemId);
    });
    expect(await read()).toMatchObject({
      code: "OK",
      target: { threadId: sent.data.threadId, customerId, orderId: order.receipt.orderId },
      proof: { itemId: imported.itemId, graphMessageId: graphId, originalMessageId: originalId, clientRequestId: requestId },
    });
    sentRequest = randomUUID();
    expect(await read()).toEqual({ code: "NO_BINDING" });

    const { saveIntakeDraftAction } = await import("@/app/actions/eingang.actions");
    const draftId = randomUUID();
    const draft = {
      id: draftId, clientEventId: randomUUID(), art: "eingang",
      payload: { clientKey: draftId, sourceItemId: imported.itemId, customerId },
      lastField: null, expectedVersion: null,
    };
    expect(await withSession(full, () => saveIntakeDraftAction(draft))).toMatchObject({ code: "CONFLICT" });
    expect(await withSession(full, () => importOutlookMailAction(graphId))).toMatchObject({
      code: "OK", itemId: imported.itemId, replayed: true,
    });
    expect(await sql`SELECT zuordnung,kunde_id FROM public.intake_item
      WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${imported.itemId}::uuid`).toEqual([{ zuordnung: "offen", kunde_id: null }]);

    sentRequest = requestId;
    expect(await withSession(full, () => importOutlookMailAction(graphId))).toMatchObject({
      code: "OK", itemId: imported.itemId, replayed: true,
    });
    const assignment = () => sql`SELECT version,zuordnung,kunde_id FROM public.intake_item
      WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${imported.itemId}::uuid`;
    const assigned = await assignment();
    expect(assigned).toMatchObject([{ zuordnung: "automatisch", kunde_id: customerId }]);
    expect(await sql`SELECT nachher->'mailThreadBinding' AS binding FROM public.intake_event
      WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${imported.itemId}::uuid AND art='zugeordnet'`).toMatchObject([{
      binding: { target: { customerId, threadId: sent.data.threadId }, proof: { itemId: imported.itemId, clientRequestId: requestId } },
    }]);
    // Even with no Sent-Items match on a later request, the saved original and the
    // existing outgoing record supply the same authority to the draft writer.
    sentRequest = randomUUID();
    expect(await withSession(full, () => saveIntakeDraftAction(fresh(draft)))).toMatchObject({
      code: "OK", drafts: expect.arrayContaining([expect.objectContaining({ id: draftId })]),
    });
    expect(await withSession(full, () => importOutlookMailAction(graphId))).toMatchObject({ code: "OK", itemId: imported.itemId });
    expect(await assignment()).toEqual(assigned);
  } finally {
    graph.mockRestore();
  }
});
