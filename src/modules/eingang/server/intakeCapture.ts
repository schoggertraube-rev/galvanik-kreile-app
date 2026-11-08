import "server-only";
import {readExpectedPackageOrders} from "@/lib/server/packageIntakeContextPort";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { hasAuthorizationArea, resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { recognizeIntakeText } from "@/lib/server/intakeTextRecognition";
import { readLiveOrderCard } from "@/lib/server/orderCardRead";
import { recognizeNoteConcerns, type IntakeCapture, type IntakeCaptureResult, type IntakeContext, type IntakeNoteInput, type IntakeCaptureKindInput } from "../captureContract";
import { CAPTURE_KINDS, captureRecognition } from "../captureRecognition";
import { intakeInvoiceReviewRequired } from "../intakeLifecycleContract";
import { mayUseContinuationSources } from "./intakeContinuationAccess";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Row = { id: string; kanal:string; version: number; text: string | null; fortsetzung_von:string|null; kunde_id: string | null; vorgang_id: string | null; vorgang_art?:string|null; zuordnung: string; einsatz: string; anliegen: string[]; anliegen_abgewaehlt:string[];anliegen_offen?:string[] };
function failure(code: Exclude<IntakeCaptureResult, { code: "OK" }>["code"], message: string): Exclude<IntakeCaptureResult, { code: "OK" }> { return { code, message }; }
function record(input: unknown): input is Record<string, unknown> { return input !== null && typeof input === "object" && !Array.isArray(input); }
function mayAccessCaptureContent(auth:AuthorizationSnapshot,channel:string){return channel!=='mail'||hasAuthorizationArea(auth,'mails');}
function context(value: unknown): value is IntakeContext | undefined {
  return value === undefined || record(value) && Object.keys(value).every(key => key === "customerId" || key === "orderId")
    && Object.values(value).every(part => typeof part === "string" && part.trim().length > 0 && part.length <= 128);
}
export async function authorizedIntakeContext(ctx?: IntakeContext): Promise<AuthorizationSnapshot | Exclude<IntakeCaptureResult, { code: "OK" }>> {
  const result = await resolveAuthorization();
  if (!result.ok) return failure(result.reason === "AUTHORIZATION_UNAVAILABLE" ? "UNAVAILABLE" : "UNAUTHENTICATED", "Sitzung konnte nicht geprüft werden. Fehlercode: INTAKE_SESSION_UNAVAILABLE.");
  const area = ctx?.orderId ? "auftraege" : ctx?.customerId ? "kunden" : "eingang";
  if (!hasAuthorizationArea(result.data, area)) return failure("FORBIDDEN", `Bereich ${area} ist nicht freigegeben.`);
  return result.data;
}
export async function intakeCaptureSnapshot(auth: AuthorizationSnapshot, itemId: string, ctx?: IntakeContext,invoiceOnly=false): Promise<IntakeCaptureResult> {
  return withPrivilegedTenantTransaction(auth, async tx => {
    const rows = await tx.execute<Row>(sql`SELECT id::text,kanal, version, text, fortsetzung_von::text, kunde_id, vorgang_id,vorgang_art, zuordnung, einsatz, anliegen,anliegen_abgewaehlt,anliegen_offen
      FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${itemId}::uuid`);
    if (rows.length !== 1) return failure("NOT_FOUND", "Eingang wurde nicht gefunden.");
    const row = rows[0];
    if(invoiceOnly&&(!hasAuthorizationArea(auth,'geld')||!row.anliegen.includes('rechnung')&&row.vorgang_art!=='rechnung'))return failure('FORBIDDEN','Rechnungsbezug für den Beleg fehlt.');
    if(!invoiceOnly&&!mayAccessCaptureContent(auth,row.kanal))return failure('FORBIDDEN','Mail-Inhalte benötigen das Recht Mails.');
    if(row.fortsetzung_von&&!await mayUseContinuationSources(tx,auth,itemId))return failure("FORBIDDEN","Original der Fortsetzung ist für diesen Login nicht freigegeben.");
    if (ctx?.customerId && row.kunde_id !== ctx.customerId || ctx?.orderId && row.vorgang_id !== ctx.orderId) return failure("FORBIDDEN", "Eingang gehört nicht zu diesem Kontext.");
    const files = await tx.execute<{ id: string; name: string; mime: string; bytes: string; readable: boolean; status: string; secured: boolean; errorCode:string|null; captureOrigin:"warenfoto"|"dokument" }>(sql`
      SELECT file.id::text,file.dateiname AS name,file.mime,file.bytes::text,file.lesbar AS readable,file.erkennung_status AS status,file.aufnahme_herkunft AS "captureOrigin",
        EXISTS(SELECT 1 FROM public.intake_event original WHERE original.tenant_id=file.tenant_id AND original.item_id=file.item_id AND original.art='original_gespeichert' AND original.nachher->>'fileId'=file.id::text) AS secured,
        (SELECT event.nachher->>'code' FROM public.intake_event event WHERE event.tenant_id=file.tenant_id AND event.item_id=file.item_id
          AND event.art='erkannt' AND event.nachher->>'fileId'=file.id::text ORDER BY event.zeit DESC,event.id DESC LIMIT 1) AS "errorCode"
      FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND (file.item_id=${itemId}::uuid OR (
        EXISTS(SELECT 1 FROM public.intake_event created
          WHERE created.tenant_id=${auth.tenantId} AND created.item_id=${itemId}::uuid AND created.art='angelegt'
            AND jsonb_exists(created.nachher->'originalFileIds',file.id::text))))
      AND (${!invoiceOnly} OR file.art<>'mime' AND file.mime<>'message/rfc822' AND lower(file.dateiname) NOT LIKE '%.eml') ORDER BY file.reihenfolge,file.id`);
    const suggestions=await tx.execute<NonNullable<IntakeCapture["suggestions"]>[number]>(sql`SELECT id::text,file_id::text AS "fileId",order_id AS "orderId",
      feld AS field,wert AS value,sicherheit AS confidence,regel AS rule,grund AS reason,fundstelle AS source,status,geprueft_von::text AS "verifiedBy",geprueft_am::text AS "verifiedAt"
      FROM public.intake_suggestion WHERE tenant_id=${auth.tenantId} AND item_id=${itemId}::uuid AND (${!invoiceOnly} OR feld LIKE 'rechnung.%') ORDER BY id`);
    const contentAllowed=!invoiceOnly&&(row.kanal!=='mail'||hasAuthorizationArea(auth,'mails'));
    const continuations = await tx.execute<{id:string}>(sql`SELECT id::text FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND fortsetzung_von=${itemId}::uuid ORDER BY erstellt_am,id`);
    const sourceText = row.fortsetzung_von ? await tx.execute<{text:string|null;source_id:string}>(sql`SELECT original.nachher->>'text' AS text,created.nachher->>'textSourceId' AS source_id
      FROM public.intake_event created JOIN public.intake_event original ON original.tenant_id=created.tenant_id
        AND original.item_id::text=created.nachher->>'textSourceId' AND original.id::text=created.nachher->>'originalTextEventId'
      WHERE created.tenant_id=${auth.tenantId} AND created.item_id=${itemId}::uuid AND created.art='angelegt'
      ORDER BY created.zeit,created.id LIMIT 1`) : [];
    if(row.fortsetzung_von && !sourceText.length) return failure("UNAVAILABLE", "Original der Fortsetzung nicht nachweisbar · Code: INTAKE_CONTINUATION_ORIGINAL_MISSING.");
    const capture: IntakeCapture = { id: row.id, version: row.version, text: contentAllowed?(row.fortsetzung_von?row.text??sourceText[0]?.text??null:row.text):null, customerId: row.kunde_id,
      continuation:{sourceId:row.fortsetzung_von,childIds:continuations.map(value=>value.id),textSourceId:contentAllowed?sourceText[0]?.source_id??null:null},
      orderId: invoiceOnly?null:row.vorgang_id, assignment: row.zuordnung, usage: row.einsatz, concerns: invoiceOnly?row.anliegen.filter(value=>value==='rechnung'):contentAllowed?row.anliegen:[],dismissedConcerns:contentAllowed?row.anliegen_abgewaehlt:[],openConcerns:contentAllowed?row.anliegen_offen:[],
      files: files.map(file => ({ ...file, bytes: Number(file.bytes) })),suggestions:contentAllowed||invoiceOnly?suggestions:[] };
    capture.recognition = invoiceOnly ? { kind: "rechnung", text: "" } : captureRecognition(capture);
    if (!invoiceOnly && hasAuthorizationArea(auth,"auftraege") && (capture.recognition.kind === "unklar" || capture.recognition.kind === "ware")) {
      capture.expectedOrders=await readExpectedPackageOrders(tx,auth,row.kunde_id);
    }
    return { code: "OK", capture };
  });
}
export async function readIntakeCapture(itemId: string, ctx?: IntakeContext): Promise<IntakeCaptureResult> {
  if (!UUID.test(itemId) || !context(ctx)) return failure("VALIDATION_ERROR", "Ungültiger Eingang.");
  const auth = await authorizedIntakeContext(ctx);
  if ("code" in auth) return auth;
  try { return await intakeCaptureSnapshot(auth, itemId, ctx); }
  catch (error) { console.error("[INTAKE_CAPTURE_READ_FAILED]", error); return failure("UNAVAILABLE", "Eingang konnte nicht geladen werden. Fehlercode: INTAKE_CAPTURE_READ_FAILED."); }
}
/** U-241: one explicit routing decision on the saved intake; the original never changes. */
export async function chooseIntakeCaptureKind(input: unknown): Promise<IntakeCaptureResult> {
  if (!record(input) || Object.keys(input).sort().join(",") !== "clientEventId,itemId,kind,version"
    || typeof input.itemId !== "string" || !UUID.test(input.itemId)
    || typeof input.clientEventId !== "string" || !UUID.test(input.clientEventId)
    || !Number.isSafeInteger(input.version) || (input.version as number) < 1
    || !CAPTURE_KINDS.some(kind => kind === input.kind)) return failure("VALIDATION_ERROR", "Art oder Eingangskennung fehlt.");
  const value = input as IntakeCaptureKindInput;
  const auth = await authorizedIntakeContext(); if ("code" in auth) return auth;
  try {
    const rejected = await withPrivilegedTenantTransaction(auth, async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${value.itemId},0))`);
      const rows = await tx.execute<{ version: number; kanal: string; erstellt_von: string; einsatz: string; anliegen: string[]; vorgang_art: string | null; vorgang_id: string | null }>(sql`
        SELECT version, kanal, erstellt_von::text, einsatz, anliegen, vorgang_art, vorgang_id FROM public.intake_item
        WHERE tenant_id=${auth.tenantId} AND id=${value.itemId}::uuid FOR UPDATE`);
      if (rows.length !== 1) return failure("NOT_FOUND", "Eingang wurde nicht gefunden.");
      const row = rows[0];
      if (!mayAccessCaptureContent(auth, row.kanal) || row.erstellt_von !== auth.userId && !hasAuthorizationArea(auth, "mails")) return failure("FORBIDDEN", "Die Art dieses Eingangs darf nur der Erfasser oder das Büro wählen.");
      const receipts = await tx.execute<{ von: string; nachher: { command: string; kind: string; inputVersion: number; version: number } }>(sql`
        SELECT von::text, nachher FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${value.itemId}::uuid AND art='erkannt' AND befehl_id=${value.clientEventId}::uuid`);
      if (receipts.length) {
        const receipt = receipts[0];
        return receipts.length === 1 && receipt.von === auth.userId && receipt.nachher.command === "eingang.art" && receipt.nachher.kind === value.kind
          && receipt.nachher.inputVersion === value.version && receipt.nachher.version === row.version ? null : failure("CONFLICT", "Die Auswahlkennung gehört zu einem anderen Eingangsstand.");
      }
      if (row.version !== value.version || row.einsatz !== "offen") return failure("CONFLICT", "Eingang wurde inzwischen weiterbearbeitet. Bitte neu öffnen.");
      if (value.kind !== "rechnung" && intakeInvoiceReviewRequired(row.anliegen, row.vorgang_art, row.vorgang_id)) return failure("CONFLICT", "Dieser Eingang enthält eine Rechnung. Bitte im Rechnungsweg bearbeiten.");
      await tx.execute(sql`UPDATE public.intake_suggestion SET status='verworfen',entschieden_von=${auth.userId},entschieden_am=statement_timestamp()
        WHERE tenant_id=${auth.tenantId} AND item_id=${value.itemId}::uuid AND feld='art' AND status='uebernommen'`);
      await tx.execute(sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,feld,wert,sicherheit,regel,grund,status,entschieden_von,entschieden_am)
        VALUES(${auth.tenantId},${value.itemId}::uuid,'art',${JSON.stringify(value.kind)}::jsonb,'sicher','hand','Art vom Erfasser gewählt','uebernommen',${auth.userId},statement_timestamp())`);
      await tx.execute(sql`UPDATE public.intake_item SET version=version+1,geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp(),
        anliegen=CASE WHEN ${value.kind === "rechnung"} AND NOT ('rechnung'=ANY(anliegen)) THEN array_append(anliegen,'rechnung') ELSE anliegen END,
        anliegen_offen=CASE WHEN ${value.kind === "rechnung"} AND NOT ('rechnung'=ANY(anliegen_offen)) THEN array_append(anliegen_offen,'rechnung') ELSE anliegen_offen END
        WHERE tenant_id=${auth.tenantId} AND id=${value.itemId}::uuid`);
      await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
        VALUES(${auth.tenantId},${value.itemId}::uuid,'erkannt',${value.clientEventId}::uuid,${auth.userId},${JSON.stringify({ command: "eingang.art", kind: value.kind, inputVersion: value.version, version: row.version + 1 })}::jsonb)`);
      return null;
    });
    return rejected ?? await intakeCaptureSnapshot(auth, value.itemId);
  } catch (error) { console.error("[INTAKE_KIND_WRITE_FAILED]", error); return failure("UNAVAILABLE", "Die gewählte Art wurde nicht bestätigt. Original bleibt erhalten · Code: INTAKE_KIND_WRITE_FAILED."); }
}
export async function discardIntakeCapture(input:unknown):Promise<IntakeCaptureResult>{
  if(!record(input)||Object.keys(input).sort().join(",")!=="clientEventId,itemId,version"
    ||typeof input.itemId!=="string"||!UUID.test(input.itemId)||typeof input.clientEventId!=="string"||!UUID.test(input.clientEventId)
    ||!Number.isSafeInteger(input.version)||(input.version as number)<1)return failure("VALIDATION_ERROR","Ungültiger Aufnahmestand.");
  const auth=await authorizedIntakeContext();if("code" in auth)return auth;
  try{
    const result=await withPrivilegedTenantTransaction(auth,async tx=>{
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${input.itemId},0))`);
      const rows=await tx.execute<{version:number;vorgang_id:string|null;kennzeichen:string[];einsatz:string;kanal:string}>(sql`SELECT version,vorgang_id,kennzeichen,einsatz,kanal FROM public.intake_item
        WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid FOR UPDATE`);
      const row=rows[0];if(rows.length!==1)return failure("NOT_FOUND","Aufnahme wurde nicht gefunden.");
      if(row.kanal==='mail')return failure('FORBIDDEN','Mail-Original bleibt erhalten. Die Erfassung kann nur ihren Bezug entfernen.');
      const repeated=await tx.execute(sql`SELECT id FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${input.itemId}::uuid AND art='einsatz' AND befehl_id=${input.clientEventId}::uuid`);
      if(repeated.length)return row.einsatz==="info"&&row.kennzeichen.includes("in_erfassung_verworfen")?null:failure("CONFLICT","Aufnahme wurde inzwischen anders verwendet.");
      if(row.vorgang_id||row.version!==input.version)return failure("CONFLICT","Aufnahme wurde inzwischen geändert. Originale bleiben erhalten.");
      await tx.execute(sql`UPDATE public.intake_item SET einsatz='info',kennzeichen=CASE WHEN kennzeichen @> ARRAY['in_erfassung_verworfen']::text[] THEN kennzeichen ELSE array_append(kennzeichen,'in_erfassung_verworfen') END,
        version=version+1,geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp()
        WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid`);
      await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher)
        VALUES(${auth.tenantId},${input.itemId}::uuid,'einsatz',${input.clientEventId}::uuid,${auth.userId},${JSON.stringify(row)}::jsonb,
          '{"einsatz":"info","grund":"in Erfassung verworfen","kennzeichen":["in_erfassung_verworfen"]}'::jsonb)`);
      return null;
    });
    return result??await intakeCaptureSnapshot(auth,input.itemId);
  }catch(error){console.error("[INTAKE_CAPTURE_DISCARD_FAILED]",error);return failure("UNAVAILABLE","Aufnahme konnte nicht gekennzeichnet werden · Original bleibt erhalten. Code: INTAKE_CAPTURE_DISCARD_FAILED.");}
}
export async function readIntakePendingScope() {
  const auth = await authorizedIntakeContext();
  if ("code" in auth) return { code: "FORBIDDEN" as const, message: "Eingang ist nicht freigegeben." };
  // Local storage partition only. This value authorizes no request and contains no identity or PIN.
  return { code: "OK" as const, scope: createHash("sha256").update(`intake-pending:${auth.tenantId}:${auth.userId}`).digest("hex") };
}
export async function saveIntakeNote(input: unknown, readCustomer: (tx: PrivilegedTenantTransaction, tenantId: string, customerId: string) => Promise<{ customerType: string } | null>): Promise<IntakeCaptureResult> {
  if (!record(input) || Object.keys(input).some(key => !["itemId", "textstand", "text", "context", "concerns"].includes(key))
    || typeof input.itemId !== "string" || !UUID.test(input.itemId) || typeof input.textstand !== "string" || !UUID.test(input.textstand)
    || typeof input.text !== "string" || !input.text.trim() || input.text.length > 20_000 || !context(input.context)
    || input.concerns !== undefined && (!Array.isArray(input.concerns) || input.concerns.some(value => typeof value !== "string"))) {
    return failure("VALIDATION_ERROR", "Notiz: 1 bis 20.000 Zeichen und eine gültige Anfragekennung erforderlich.");
  }
  const note = input as unknown as IntakeNoteInput;
  const auth = await authorizedIntakeContext(note.context);
  if ("code" in auth) return auth;
  try {
    const order = note.context?.orderId ? await readLiveOrderCard(auth, { orderId: note.context.orderId }) : null;
    if (order && order.code !== "OK") return failure("NOT_FOUND", "Vorgang konnte nicht sicher gelesen werden.");
    const orderCustomerId = order?.code === "OK" ? order.data.customerId : null;
    const saved = await withPrivilegedTenantTransaction(auth, tx => writeIntakeNoteInTransaction(tx,auth,note,readCustomer,orderCustomerId));
    return saved ?? await intakeCaptureSnapshot(auth, note.itemId);
  } catch (error) {
    console.error("[INTAKE_NOTE_WRITE_FAILED]", error);
    return failure("UNAVAILABLE", "Speichern fehlgeschlagen · alle Eingaben sind noch da. Fehlercode: INTAKE_NOTE_WRITE_FAILED.");
  }
}
export function readIntakeNoteText(text: string) {
  if (text.length > 20_000) throw new Error("INTAKE_NOTE_TEXT_TOO_LONG");
  return { recognition: recognizeIntakeText(text), concerns: recognizeNoteConcerns(text) };
}

/** The same note writer, composed with customer/draft writes in one transaction. */
export async function writeIntakeNoteInTransaction(
  tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,note:IntakeNoteInput,
  readCustomer:(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string)=>Promise<{customerType:string}|null>,
  orderCustomerId:string|null=null,
){
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${note.itemId},0))`);
  let customerId = note.context?.customerId ?? null;
  if (note.context?.orderId) {
    if (!orderCustomerId || customerId && orderCustomerId !== customerId) return failure("NOT_FOUND", "Vorgang gehört nicht zum gewählten Kunden.");
    customerId = orderCustomerId;
  }
  if (customerId) {
    const customer = await readCustomer(tx, auth.tenantId, customerId);
    if (!customer) return failure("NOT_FOUND", "Kunde wurde nicht gefunden.");
    if (customer.customerType === "lieferant" && !hasAuthorizationArea(auth, "geld")) return failure("FORBIDDEN", "Lieferant erfordert Recht geld.");
  }
  const recognized = recognizeNoteConcerns(note.text);
  const existing = await tx.execute<Row>(sql`SELECT id::text,kanal,version,text,kunde_id,vorgang_id,zuordnung,einsatz,anliegen,anliegen_abgewaehlt FROM public.intake_item
    WHERE tenant_id=${auth.tenantId} AND id=${note.itemId}::uuid FOR UPDATE`);
  if(existing[0]&&!mayAccessCaptureContent(auth,existing[0].kanal))return failure('FORBIDDEN','Mail-Inhalte benötigen das Recht Mails.');
  if(existing[0]?.kanal==='mail')return failure('FORBIDDEN','Mail-Original bleibt unverändert. Bitte eine eigene Notiz anlegen.');
  const declined=note.concerns?recognized.filter(value=>!note.concerns!.includes(value.id)).map(value=>value.id):existing[0]?.text===note.text?existing[0].anliegen_abgewaehlt:[];
  const declinedSql=sql`ARRAY[${sql.join(declined.map(value=>sql`${value}`),sql`, `)}]::text[]`;
  const selected = note.concerns ?? recognized.filter(value=>!declined.includes(value.id)).map(value => value.id);
  if (selected.some(id => !recognized.some(value => value.id === id))) return failure("VALIDATION_ERROR", "Anliegen passt nicht zur erkannten Notiz.");
  const selectedSql = sql`ARRAY[${sql.join(selected.map(value => sql`${value}`), sql`, `)}]::text[]`;

  const repeated = await tx.execute<{ text: string }>(sql`SELECT nachher->>'text' AS text FROM public.intake_event
    WHERE tenant_id=${auth.tenantId} AND item_id=${note.itemId}::uuid AND art='original_gespeichert' AND befehl_id=${note.textstand}::uuid`);
  if (repeated.length) {
    return repeated.length === 1 && repeated[0].text === note.text && JSON.stringify(existing[0]?.anliegen) === JSON.stringify(selected)
      ? null : failure("CONFLICT", "Textstand wurde bereits anders verwendet. Eingaben bleiben erhalten.");
  }
  const usage = customerId ? selected.length ? "offen" : "info" : note.concerns?.length === 0 ? "info" : "offen";
  if (!existing.length) {
    await tx.execute(sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,text,kunde_id,vorgang_art,vorgang_id,zuordnung,einsatz,anliegen,anliegen_offen,anliegen_abgewaehlt)
      VALUES(${note.itemId}::uuid,${auth.tenantId},${note.itemId},'notiz','intern','geraet',${auth.userId}::uuid,${note.text},${customerId},${note.context?.orderId ? "auftrag" : null},${note.context?.orderId ?? null},${customerId ? "hand" : "offen"},${usage},${selectedSql},${selectedSql},${declinedSql})`);
    await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES
      (${auth.tenantId},${note.itemId}::uuid,'angelegt',${note.itemId}::uuid,${auth.userId},${JSON.stringify({ kanal: "notiz", richtung: "intern" })}::jsonb)`);
  } else {
    if (existing[0].kunde_id && existing[0].kunde_id !== customerId) return failure("CONFLICT", "Eingang gehört bereits zu einem anderen Kunden.");
    if (existing[0].vorgang_id && existing[0].vorgang_id !== note.context?.orderId) return failure("CONFLICT", "Eingang ist bereits einem Vorgang zugeordnet.");
    await tx.execute(sql`UPDATE public.intake_item SET kanal='notiz',richtung='intern',text=${note.text},anliegen=${selectedSql},anliegen_offen=${selectedSql},anliegen_abgewaehlt=${declinedSql},einsatz=${usage},version=version+1
      WHERE tenant_id=${auth.tenantId} AND id=${note.itemId}::uuid`);
  }
  await tx.execute(sql`UPDATE public.intake_suggestion SET status='verworfen',entschieden_von='system',entschieden_am=statement_timestamp()
    WHERE tenant_id=${auth.tenantId} AND item_id=${note.itemId}::uuid AND file_id IS NULL AND status='offen'`);
  for (const concern of recognized.filter(value => selected.includes(value.id))) {
    await tx.execute(sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,feld,wert,sicherheit,regel,grund,status)
      VALUES(${auth.tenantId},${note.itemId}::uuid,'anliegen',${JSON.stringify(concern.id)}::jsonb,'vorschlag','notiz','Signal im Originaltext','offen')`);
  }
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher) VALUES
    (${auth.tenantId},${note.itemId}::uuid,'original_gespeichert',${note.textstand}::uuid,${auth.userId},${JSON.stringify(existing[0] ?? null)}::jsonb,${JSON.stringify({ text: note.text, anliegen: selected, einsatz: usage })}::jsonb)`);
  return null;
}
