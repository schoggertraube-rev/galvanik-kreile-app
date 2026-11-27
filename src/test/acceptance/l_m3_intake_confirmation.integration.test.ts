// @vitest-environment node
import { expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const tenant = vi.hoisted(() => "TEST-ablauf-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: tenant }));
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { sql, full, withSession, nativeFetch, createFixture } from "../../../e2e/ablauf/replayHarness";
import { customerFixture, intakeOrderFixture } from "../../../e2e/ablauf/orderFixture";

const fresh = <T>(input: T): T => JSON.parse(JSON.stringify(input));

it.each([
  {assignment:"automatisch",withdraw:false},
  {assignment:"bestaetigt",withdraw:false},
  {assignment:"bestaetigt",withdraw:true},
] as const)("L-M3 keeps the confirmation decision on retry ($assignment, withdrawal before send=$withdraw)", async ({assignment,withdraw}) => {
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
    const { assignIntakeCustomerAction, erfasseAuftragAusEingangAction, getIntakeAssignmentAction } = await import("@/app/actions/eingang.actions");
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
    const result = await withSession(full, async()=>{
      const booked=await erfasseAuftragAusEingangAction(input);
      if(withdraw&&booked.code==="OK"){
        const assigned=await getIntakeAssignmentAction({itemId:sourceId,mode:"normal"});
        if(assigned.code!=="OK")throw Error("TEST_LM3_CONFIRMATION_ASSIGNMENT_REQUIRED");
        expect(await assignIntakeCustomerAction({
          itemId:sourceId,version:assigned.view.version,mode:"undo",clientEventId:randomUUID(),
        })).toMatchObject({code:"OK"});
      }
      return booked;
    },true);
    if (result.code !== "OK") throw Error(`TEST_LM3_BOOKING:${result.code}:${result.message}`);
    expect(result.intakeItemId).toBe(sourceId);
    const outbox = await sql`SELECT status FROM public.outbox_mails WHERE tenant_id=${KREILE_TENANT_SLUG} AND objekt=${result.orderId}`;
    const expectedSends = assignment === "bestaetigt" && !withdraw ? 1 : 0;
    expect(outbox).toEqual(assignment==="bestaetigt" ? [{ status: withdraw?"wartet":"gesendet" }] : []);
    expect(await withSession(full, () => erfasseAuftragAusEingangAction(fresh(input)), true))
      .toMatchObject({ code: "OK", orderId: result.orderId, replayed: true });
    expect(sends).toBe(expectedSends);
    if(withdraw){
      const [source]=await sql`SELECT kunde_id,vorgang_id,zuordnung FROM public.intake_item
        WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${sourceId}::uuid`;
      expect(source).toEqual({kunde_id:null,vorgang_id:null,zuordnung:'offen'});
      expect(await withSession(full,()=>erfasseAuftragAusEingangAction(fresh({...input,text:'TEST anderer Auftrag mit altem Schlüssel'})),true))
        .toMatchObject({code:'CONFLICT'});
      expect(await sql`SELECT event.id FROM public.events event JOIN public.outbox_mails outbox
        ON outbox.tenant_id=event.tenant_id AND outbox.id=event.correlation_id
        WHERE outbox.tenant_id=${KREILE_TENANT_SLUG} AND outbox.objekt=${result.orderId}
         AND event.event_type IN ('COMMUNICATION_MAIL_PREPARED_V1','COMMUNICATION_MAIL_SENT_V1')`).toHaveLength(0);
    }
  } finally {
    graph.mockRestore();
  }
});

it.each(['original', 'newer instruction', 'callback'] as const)(
 "L-M3 changes handover only after assignment and undoes the exact original effect (%s)", async variant => {
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
    ${customerId},'automatisch','offen','Ab jetzt immer abholen.',ARRAY['abholung'],ARRAY['abholung'],
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
  const { updateCustomerAction } = await import("@/app/actions/customers.actions");
  const orderId = order.receipt.orderId;
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
  if (variant === 'callback') {
    await sql`INSERT INTO public.shipments(id,tenant_id,order_id,carrier,status,label_url)
      VALUES(${randomUUID()}::uuid,${KREILE_TENANT_SLUG},${orderId},'TEST Versanddienst','created','https://example.invalid/TEST-etikett')`;
  }
  const confirmed = { ...input, sourceVersion: assigned.version };
  const changed = await withSession(full, () => changeOrderPickupNoticeAction(confirmed));
  const mode = variant === 'callback' ? 'shipping' : 'pickup';
  expect(changed, JSON.stringify(changed)).toMatchObject({
    code: "OK", replayed: false, receipt: { handoverMode: mode, outcome: variant === 'callback' ? 'call_customer' : 'changed' },
  });
  expect(await withSession(full, () => changeOrderPickupNoticeAction(fresh(confirmed)))).toMatchObject({
    code: "OK", replayed: true, receipt: { handoverMode: mode },
  });
  expect(await sql`SELECT handover_preference FROM public.customers
    WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`).toEqual([{handover_preference:'pickup'}]);

  const tasks = async () => sql`SELECT client_key::text,status FROM public.tasks
    WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_typ='auftrag' AND bezug_id=${orderId} AND art='rueckruf'`;
  const otherKey = randomUUID();
  if (variant === 'callback' || variant === 'newer instruction') {
    const modes = variant === 'callback' ? ['pickup'] as const : ['shipping','pickup'] as const;
    for (const nextMode of modes) {
      const [current] = await sql`SELECT version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`;
      expect(await withSession(full, () => changeOrderPickupNoticeAction({
        command:'handover_manual',orderId,expectedVersion:current.version,
        handoverMode:nextMode,clientEventId:variant==='callback'?otherKey:randomUUID(),
      }))).toMatchObject({code:'OK'});
      if (variant==='newer instruction') {
        expect(await withSession(full, () => updateCustomerAction({
          customerId,handoverPreference:nextMode,clientEventId:randomUUID(),
        }))).toMatchObject({code:'OK'});
      }
    }
  }
  if (variant === 'callback') expect(await tasks()).toEqual(expect.arrayContaining([
    {client_key:confirmed.clientEventId,status:'offen'},{client_key:otherKey,status:'offen'},
  ]));
  const undo = {mode:'undo' as const,itemId,version:assigned.version+1,clientEventId:randomUUID()};
  if (variant === 'original') {
    const assignmentOnly = await createFixture(['eingang','kunden','mails']);
    expect(await withSession(assignmentOnly, () => assignIntakeCustomerAction({...undo,clientEventId:randomUUID()})))
      .toMatchObject({code:'FORBIDDEN'});
  }
  expect(await withSession(full, () => assignIntakeCustomerAction(undo))).toMatchObject({code:'OK',replayed:false});
  expect(await withSession(full, () => assignIntakeCustomerAction(fresh(undo)))).toMatchObject({code:'OK',replayed:true});
  expect(await sql`SELECT handover_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`)
    .toEqual([{handover_mode:variant==='newer instruction'?'pickup':'shipping'}]);
  expect(await sql`SELECT handover_preference FROM public.customers
    WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`)
    .toEqual([{handover_preference:variant==='newer instruction'?'pickup':null}]);
  if (variant === 'callback') expect(await tasks()).toEqual(expect.arrayContaining([
    {client_key:confirmed.clientEventId,status:'erledigt'},{client_key:otherKey,status:'offen'},
  ]));
  const history = await sql`SELECT nachher->'handover' AS handover FROM public.intake_event
    WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND art='zurueckgenommen'`;
  expect(history).toEqual([{handover:{
    sourceEventId:expect.any(String),
    restoredOrderEventId:variant==='original'?expect.any(String):null,
    restoredPreferenceKey:variant==='newer instruction'?null:expect.any(String),
    closedTaskId:variant==='callback'?expect.any(String):null,
  }}]);
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
  const { assignIntakeCustomerAction, erfasseAuftragAusEingangAction, getIntakeDraftsAction, saveIntakeDraftAction } =
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
  if(saved.code!=='OK')throw Error('TEST_DRAFT_SAVE_REQUIRED');
  const originalDraft=saved.drafts.find(row=>row.id===id);
  if(!originalDraft)throw Error('TEST_DRAFT_READBACK_REQUIRED');
  const expected = { code: "OK", drafts: expect.arrayContaining([expect.objectContaining({ id, payload: save.payload })]) };
  expect(await withSession(full, () => getIntakeDraftsAction())).toMatchObject(expected);
  expect(await withSession(full, () => saveIntakeDraftAction(fresh(save)))).toMatchObject(expected);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}
    AND event_type='INTAKE_DRAFT_SAVED_V1' AND client_event_id=${clientEventId}::uuid`).toHaveLength(1);
  const withdrawn=await withSession(full,()=>assignIntakeCustomerAction({
    itemId,version:2,clientEventId:randomUUID(),mode:"undo",
  }));
  expect(withdrawn).toMatchObject({code:"OK",restoredTaskId:null});
  expect(await withSession(full,()=>getIntakeDraftsAction())).toMatchObject({code:"OK",drafts:[]});
  expect(await withSession(full,()=>saveIntakeDraftAction(fresh(save)))).toMatchObject({code:"OK",drafts:[]});
  expect(await withSession(full,()=>saveIntakeDraftAction({ ...save,clientEventId:randomUUID(),expectedVersion:originalDraft.version })))
    .toMatchObject({code:"CONFLICT"});
  const bookingKey=randomUUID();
  expect(await withSession(full,()=>erfasseAuftragAusEingangAction({
    clientKey:bookingKey,draftId:id,geprueft:false,text:'TEST eingefrorener Entwurf aus Kundennachricht',
    customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',
    intakeSource:'anfrage_mail',handoverMode:'pickup',paymentMode:'rechnung',sourceCaptures:[{id:itemId,version:3}],
    items:[{catalogServiceId:null,name:'TEST Teil',quantity:3,material:'Messing',surfaceRequested:'Verchromen',
      executionRequested:'offen',unit:'Stück',unitPriceCents:null,vatRateBasisPoints:null}],
  }))).toMatchObject({code:'CONFLICT'});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}
    AND event_type='ORDER_INTAKE_CREATED_V1' AND client_event_id=${bookingKey}::uuid`).toHaveLength(0);
  expect(await sql`SELECT payload,version FROM private.intake_drafts WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${id}::uuid`)
    .toEqual([{payload:save.payload,version:originalDraft.version}]);
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
