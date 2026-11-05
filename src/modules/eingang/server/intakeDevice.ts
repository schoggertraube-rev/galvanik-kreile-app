import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { authorizedIntakeContext } from "./intakeCapture";
import type { IntakeDeviceCommand, IntakeDeviceRequest, IntakeDeviceResult } from "../deviceContract";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
type Row = { id: string; item_id: string; status: IntakeDeviceRequest["status"]; ablauf_am: Date | string; angenommen_auf: string[]; fertig_auf: string[]; token_sitzung: string };
function valid(input: unknown): input is IntakeDeviceCommand {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  const uuid = (key: string) => typeof value[key] === "string" && UUID.test(value[key]);
  if (value.command === "request") return Object.keys(value).every(k => ["command", "itemId"].includes(k)) && uuid("itemId");
  if (value.command === "accept") return Object.keys(value).every(k => ["command", "deviceId", "requestId", "token"].includes(k)) && uuid("deviceId")
    && (uuid("requestId") ? value.token === undefined : value.requestId === undefined && typeof value.token === "string" && /^[a-f0-9]{32}$/.test(value.token));
  if (value.command === "end") return Object.keys(value).every(k => ["command", "deviceId", "requestId", "reason"].includes(k)) && uuid("requestId") && uuid("deviceId") && ["fertig", "abgebrochen", "geschlossen"].includes(String(value.reason));
  return value.command === "refresh" && Object.keys(value).every(k => ["command", "requestId"].includes(k)) && (value.requestId === undefined || uuid("requestId"));
}
async function readViews(tx: PrivilegedTenantTransaction, tenantId: string, userId: string, id?: string): Promise<IntakeDeviceRequest[]> {
  const rows = await tx.execute<Row & { photos: string }>(sql`SELECT r.id::text,r.item_id::text,r.status,r.ablauf_am,r.angenommen_auf,r.fertig_auf,r.token_sitzung,
    (SELECT count(*)::text FROM public.intake_file f WHERE f.tenant_id=r.tenant_id AND f.item_id=r.item_id AND f.art='foto' AND f.aufgenommen_auf=ANY(r.angenommen_auf)
      AND EXISTS (SELECT 1 FROM public.intake_event e WHERE e.tenant_id=f.tenant_id AND e.befehl_id=f.id AND e.art='original_gespeichert')) AS photos
    FROM public.device_request r WHERE r.tenant_id=${tenantId} AND r.login_id=${userId}::uuid
      AND ${id ? sql`r.id=${id}::uuid` : sql`r.status IN ('angefordert','angenommen','fotos_da')`} ORDER BY r.erstellt_am,r.id`);
  return rows.map(row => ({ id: row.id, itemId: row.item_id, status: row.status, expiresAt: new Date(row.ablauf_am).toISOString(), acceptedOn: row.angenommen_auf, finishedOn: row.fertig_auf, photoCount: Number(row.photos) }));
}
export async function processIntakeDeviceRequest(input: unknown, sessionFingerprint: string | null): Promise<IntakeDeviceResult> {
  if (!valid(input)) return { code: "VALIDATION_ERROR", message: "Ungültige Foto-Anfrage." };
  const auth = await authorizedIntakeContext(); if ("code" in auth) return auth;
  if (!sessionFingerprint || !/^[a-f0-9]{64}$/.test(sessionFingerprint)) return { code: "UNAUTHENTICATED", message: "Sitzung konnte nicht gebunden werden." };
  try {
    return await withPrivilegedTenantTransaction(auth, async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('device-request:'||${auth.tenantId}||':'||${auth.userId},0))`);
      await tx.execute(sql`UPDATE public.device_request SET status='abgelaufen'
        WHERE tenant_id=${auth.tenantId} AND login_id=${auth.userId}::uuid AND status IN ('angefordert','angenommen') AND ablauf_am<=statement_timestamp()
        RETURNING id::text,item_id::text`);
      if (input.command === "refresh") return { code: "OK", requests: await readViews(tx, auth.tenantId, auth.userId, input.requestId) };
      if (input.command === "request") {
        await tx.execute(sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von)
          VALUES(${input.itemId}::uuid,${auth.tenantId},${input.itemId},'foto','rein','geraet',${auth.userId}::uuid) ON CONFLICT(tenant_id,client_key) DO NOTHING`);
        const item = await tx.execute<{ id: string }>(sql`SELECT id::text FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid`);
        if (item.length !== 1) return { code: "NOT_FOUND", message: "Eingang wurde nicht gefunden." };
        await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
          SELECT ${auth.tenantId},${input.itemId}::uuid,'angelegt',${input.itemId}::uuid,${auth.userId},'{"kanal":"foto","richtung":"rein"}'::jsonb
          WHERE NOT EXISTS(SELECT 1 FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${input.itemId}::uuid AND art='angelegt')`);
        const rows = await tx.execute<Row>(sql`SELECT * FROM public.device_request WHERE tenant_id=${auth.tenantId} AND login_id=${auth.userId}::uuid
          AND item_id=${input.itemId}::uuid AND status IN ('angefordert','angenommen','fotos_da') ORDER BY erstellt_am DESC LIMIT 1 FOR UPDATE`);
        const previous = rows[0];
        if (previous && previous.status !== "angefordert") return { code: "OK", requests: await readViews(tx, auth.tenantId, auth.userId, previous.id) };
        const id = previous?.id ?? randomUUID(), token = randomBytes(16).toString("hex"), hash = createHash("sha256").update(token).digest("hex");
        if (previous) await tx.execute(sql`UPDATE public.device_request SET token_hash=${hash} WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid`);
        else {
          await tx.execute(sql`INSERT INTO public.device_request(id,tenant_id,login_id,item_id,zweck,token_hash,token_sitzung,status,ablauf_am)
            VALUES(${id}::uuid,${auth.tenantId},${auth.userId}::uuid,${input.itemId}::uuid,'fotos',${hash},'','angefordert',statement_timestamp()+interval '10 minutes')`);
        }
        return { code: "OK", requests: await readViews(tx, auth.tenantId, auth.userId, id), token };
      }
      const selector = input.command === "accept" && input.token
        ? sql`token_hash=${createHash("sha256").update(input.token).digest("hex")}` : sql`id=${input.requestId}::uuid`;
      const rows = await tx.execute<Row>(sql`SELECT * FROM public.device_request WHERE tenant_id=${auth.tenantId} AND login_id=${auth.userId}::uuid AND ${selector} FOR UPDATE`);
      const row = rows[0]; if (rows.length !== 1) return { code: "NOT_FOUND", message: "Foto-Anfrage wurde nicht gefunden." };
      if (input.command === "accept") {
        if (["abgelaufen", "beendet"].includes(row.status)) return { code: "CONFLICT", message: "Anfrage abgelaufen." };
        if (input.token && row.token_sitzung && row.token_sitzung !== sessionFingerprint) return { code: "CONFLICT", message: "Code schon benutzt." };
        const newlyAccepted = !row.angenommen_auf.includes(input.deviceId);
        if (newlyAccepted || input.token && !row.token_sitzung) {
          await tx.execute(sql`UPDATE public.device_request SET angenommen_auf=CASE WHEN ${newlyAccepted} THEN array_append(angenommen_auf,${input.deviceId}) ELSE angenommen_auf END,
            token_sitzung=CASE WHEN ${Boolean(input.token)} THEN ${sessionFingerprint} ELSE token_sitzung END,
            status=CASE WHEN status='angefordert' THEN 'angenommen' ELSE status END WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid`);
        }
      } else if (!["beendet", "abgelaufen"].includes(row.status)) {
        if (input.reason !== "fertig" || !row.fertig_auf.includes(input.deviceId)) {
          const finished = input.reason === "fertig" ? [...row.fertig_auf, input.deviceId] : row.fertig_auf;
          const ended = input.reason !== "fertig" || row.angenommen_auf.every(device => finished.includes(device));
          await tx.execute(sql`UPDATE public.device_request SET fertig_auf=ARRAY[${sql.join(finished.map(device => sql`${device}`), sql`, `)}]::text[],
            status=${ended ? "beendet" : row.status},beendet_art=${ended ? input.reason : null} WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid`);
        }
      }
      return { code: "OK", requests: await readViews(tx, auth.tenantId, auth.userId, row.id) };
    });
  } catch (error) {
    console.error("[INTAKE_DEVICE_REQUEST_FAILED]", error);
    return { code: "UNAVAILABLE", message: "Foto-Anfrage konnte nicht gespeichert werden. Code: INTAKE_DEVICE_REQUEST_FAILED." };
  }
}
