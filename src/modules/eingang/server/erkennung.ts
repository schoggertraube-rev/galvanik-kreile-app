import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { recordObservedFailure } from "@/lib/server/actionObservation";
import { recognizeIntakeText } from "@/lib/server/intakeTextRecognition";
import { withPrivilegedTenantTransaction, withTenantSavepoint, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { analyzeWithAzureDocumentIntelligence, azureOfficeFormat, readAzureRecognitionOriginal, supportsAzureDocument } from "@/lib/server/azureDocumentIntelligence";
import type { DocumentSuggestion } from "@/lib/server/azureDocumentIntelligence";
import { concernForCaptureKind, PARCEL_CARRIER, recognizeCaptureDocument } from "../captureRecognition";
import { recognizeNoteConcerns } from "../captureContract";
import { readMimeOriginalText, safeOfficeRecognitionBytes } from "../originalSafety";
import { recognizeInvoiceFields, recognizeInvoicePdf, recognizeInvoiceXml } from "./invoiceRecognition";
import { readAzurePositionRows } from "./intakeRecognitionPositions";
import { saveIntakeRecognitionOriginal } from "./intakeRecognitionStorage";
import { sucheKandidatenInTransaction, type KandidatenPorts, type EingangKandidatenEinstellungen } from "./kandidaten";
import { findeVerdachtsmuster, istEigenerLieferantenwert, istLieferantenwert } from "./eingangsRegeln";
import { istBelegart, schlageBelegidentitaetVor } from "./belegIdentitaet";
import { eingangCopy } from "@/ui/eingangCopy";

const BUCKET = "scans";

export type ReadRecognitionSettings = (tx: PrivilegedTenantTransaction, tenantId: string) => Promise<{
  erkennung_modelle: { dokument: string; rechnung: string | null; bon: string | null };
  ki_sicherheitsschwelle: number | null;
  dokument_lesen: boolean | null;
  eingang_vorschlaege_max?: number | null;
  eingang_kandidat_stufen?: EingangKandidatenEinstellungen['eingang_kandidat_stufen'] | null;
  eingang_verdacht_muster?: readonly string[] | null;
}>;

function documentSuggestions(suggestions: readonly DocumentSuggestion[]) {
  return [
    ...suggestions.filter(suggestion => suggestion.field !== "DOCUMENT_TEXT"),
    ...recognizeInvoiceFields(suggestions),
  ];
}

function suggestionKey(suggestion: ReturnType<typeof documentSuggestions>[number]) {
  return JSON.stringify([suggestion.field, suggestion.source.page,
    suggestion.field.startsWith("rechnung.") ? null : suggestion.value]);
}

function recognitionClaimKey(attempt:string){const bytes=createHash('sha1').update('intake-recognition-start-v1:'+attempt).digest();bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=bytes.subarray(0,16).toString('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}

function recognitionReceiptKey(fileId: string, retryKey?: string) {
  return retryKey ?? recognitionClaimKey('result:'+fileId);
}

type RecognitionContext = {
  tenantId: string;
  akteur: string;
  file: { item_id: string; dateiname: string; mime: string; sha256: string; aufnahme_herkunft: "warenfoto" | "dokument"; reihenfolge: number };
  bytes: Uint8Array;
  onlyInvoiceAccess: boolean;
  retryKey?: string;
  kandidaten?: KandidatenPorts;
};

async function readSecuredMailMetadata(tx: PrivilegedTenantTransaction, tenantId: string, itemId: string, fileId: string, sha256: string) {
  const rows = await tx.execute<{ subject: string | null; receivedAt: string }>(sql`
    SELECT item.betreff AS subject, coalesce(item.empfangen_am,file.aufgenommen_am)::text AS "receivedAt"
    FROM public.intake_item item
    JOIN public.intake_file file ON file.tenant_id=item.tenant_id AND file.item_id=item.id AND file.id=${fileId}::uuid AND file.sha256=${sha256}
    JOIN public.intake_event receipt ON receipt.tenant_id=item.tenant_id AND receipt.item_id=item.id
      AND receipt.art='original_gespeichert' AND receipt.nachher->>'fileId'=${fileId} AND receipt.nachher->>'sha256'=${sha256}
    WHERE item.tenant_id=${tenantId} AND item.id=${itemId}::uuid AND file.mime='message/rfc822'`);
  if (rows.length > 1) throw Error("INTAKE_MAIL_RECOGNITION_SOURCE_AMBIGUOUS");
  return rows[0] ?? null;
}

const headFields = [
  ["beleg.nummer", /^(?:beleg|bon|quittungs) ?(?:nummer|nr)$/u],
  ["beleg.datum", /^(?:beleg|bon|quittungs) ?datum$/u],
  ["lieferant.name", /^(?:lieferant(?:enname)?|lieferanten name|händler|vendor name|merchant name)$/u],
  ["lieferant.ustid", /^(?:umsatzsteuer id|ust id(?: nr)?|vat (?:id|number)|vendor tax id)$/u],
  ["bestellnummer", /^(?:bestell ?(?:nummer|nr)|purchase order(?: number)?)$/u],
  ["lieferscheinnummer", /^(?:lieferschein ?(?:nummer|nr)|delivery note(?: number)?)$/u],
  ["waehrung", /^(?:währung|waehrung|currency)$/u],
  ["sendungsnummer", /^(?:sendungs ?(?:nummer|nr)|tracking ?(?:nummer|number|no))$/u],
  ["paketdienst", /^(?:paketdienst|versanddienstleister|carrier)$/u],
] as const;

function readHeadFields(suggestions: readonly DocumentSuggestion[], goodsPhoto: boolean) {
  const heads: { field: string; value: string; confidence: number | null; source: DocumentSuggestion["source"] }[] = [];
  for (const read of suggestions) {
    const label = read.label.toLocaleLowerCase("de-DE").normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const match = headFields.find(([, pattern]) => pattern.test(label));
    if (match) heads.push({ field: match[0], value: read.value, confidence: read.confidence, source: read.source });
  }
  const text = goodsPhoto ? suggestions.find(read => read.field === "DOCUMENT_TEXT") : null;
  if (text) {
    const carrier = PARCEL_CARRIER.exec(text.value)?.[0];
    if (carrier && !heads.some(read => read.field === "paketdienst")) {
      heads.push({ field: "paketdienst", value: carrier, confidence: null, source: text.source });
    }
    const tracking = /^[ \t]*(?:sendungs(?:nummer|nr\.?)|tracking[ \t]+(?:number|no\.?))[ \t:#]+([A-Z0-9][A-Z0-9-]*)[ \t]*$/imu.exec(text.value)?.[1];
    if (tracking && /\d/u.test(tracking) && !heads.some(read => read.field === "sendungsnummer")) {
      heads.push({ field: "sendungsnummer", value: tracking, confidence: null, source: text.source });
    }
  }
  return heads;
}

export async function erkenneOriginal(kontext: RecognitionContext, fileId: string, einstellungen: ReadRecognitionSettings) {
  const { tenantId, akteur, file, bytes, onlyInvoiceAccess, retryKey } = kontext;
  const auth = { tenantId };
  const claimKey=recognitionClaimKey(retryKey??fileId);
  let claimOwned=false;
  try {
    const claimed = await withPrivilegedTenantTransaction(auth, async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-file:'||${auth.tenantId}||':'||${fileId},0))`);
      const updated = await tx.execute<{ id: string }>(sql`UPDATE public.intake_file SET erkennung_status='laeuft' WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid AND erkennung_status='wartet' RETURNING id::text`);
      if(updated.length===1)await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
        VALUES(${auth.tenantId},${file.item_id}::uuid,'einsatz',${claimKey}::uuid,${akteur},${JSON.stringify({action:'erkennung_gestartet',fileId,attemptKey:retryKey??fileId})}::jsonb) ON CONFLICT DO NOTHING`);
      return updated.length === 1;
    });
    if (!claimed) return;
    claimOwned=true;
    const isMail = file.mime === "message/rfc822";
    const metadata = isMail ? await withPrivilegedTenantTransaction(auth,
      tx => readSecuredMailMetadata(tx, auth.tenantId, file.item_id, fileId, file.sha256)) : null;
    const body = metadata ? readMimeOriginalText(bytes) : null;
    const mail = metadata && body !== null ? { ...metadata, body,
      truncated: body.length > 20000 && Array.from(body.slice(0,40002)).length > 20000 } : null;
    const mailReading = mail ? recognizeIntakeText(mail.body, new Date(mail.receivedAt), true) : null;
    const mailHasValues = mailReading && (mailReading.fields.length || mailReading.positions.length
      || mailReading.quoteChanges || mailReading.deliveryWeeks || mailReading.instructions?.length);
    // Structured originals use the same XML parser; unstructured documents retain the OCR path.
    const prefix=Buffer.from(bytes.subarray(0,512)).toString('utf8').replace(/^\uFEFF/u,'').trimStart();
    const officeFormat = azureOfficeFormat(file.mime);
    const isXml=!isMail&&!officeFormat&&(/xml(?:$|[;+])/iu.test(file.mime)||/\.xml$/iu.test(file.dateiname)||prefix.startsWith('<'));
    const pdfResult=file.mime==='application/pdf'&&!isXml?await recognizeInvoicePdf(bytes):null;
    const xmlResult=isXml?recognizeInvoiceXml(bytes):pdfResult;
    const canRead = isMail ? mail !== null : isXml ? xmlResult?.code==='OK'
      : supportsAzureDocument(file.mime, bytes.byteLength, true)
        && (!officeFormat || safeOfficeRecognitionBytes(file.dateiname, bytes, officeFormat));
    const usesDocumentReader = !isMail && !isXml && xmlResult?.code !== "OK";
    const needsOcr = usesDocumentReader && canRead;
    const leseEinstellungen = () => withPrivilegedTenantTransaction(auth, tx => einstellungen(tx, auth.tenantId));
    const settings = mail ? await leseEinstellungen().catch(() => {
      recordObservedFailure('INTAKE_RECOGNITION_SETTINGS_UNAVAILABLE');
      return null;
    })
      : usesDocumentReader || xmlResult?.code === "OK" ? await leseEinstellungen() : null;
    const threshold = settings?.ki_sicherheitsschwelle ?? null;
    const deadline = AbortSignal.timeout(30_000);
    const readModel = async (model: string, keyValuePairs: boolean) => {
      let result = await analyzeWithAzureDocumentIntelligence(bytes, file.mime, model, process.env,
        (url, options) => fetch(url, { ...options, signal: AbortSignal.any([deadline, AbortSignal.timeout(12_000)]) }),
        undefined, { subject: { type: "intake", id: file.item_id }, originalRef: fileId,
          allowOffice: officeFormat !== null, keyValuePairs, languages: keyValuePairs });
      if (result.code !== "OK") recordObservedFailure('INTAKE_FILE_RECOGNITION_UNAVAILABLE');
      let rawPath: string | null = null;
      if (result.code === "OK" && result.original) {
        const original = result.original;
        try {
          const saved = await saveIntakeRecognitionOriginal({
            bucket: BUCKET, tenantId: auth.tenantId, originalSha256: file.sha256,
            model: original.model, bytes: original.bytes,
          });
          if (saved.bytes !== original.bytes) result = readAzureRecognitionOriginal(saved.bytes, original.model);
          rawPath = saved.path;
        } catch {
          recordObservedFailure('INTAKE_RAW_NOT_SAVED');
        }
      }
      return { result, rawPath };
    };
    const ocrDisabled = usesDocumentReader && settings?.dokument_lesen === false;
    const ocrSettingMissing = needsOcr && settings?.dokument_lesen == null;
    const primary = needsOcr && settings?.dokument_lesen === true
      ? await readModel(settings.erkennung_modelle.dokument, true) : null;
    const recognized = primary?.result ?? null;
    const rawPath = primary?.rawPath ?? null;
    const ocr = recognized?.code === "OK" ? recognized : null;
    const rawStorageFailed = ocr !== null && rawPath === null;
    const goodsPhoto = file.aufnahme_herkunft === "warenfoto" && file.mime.startsWith("image/");
    const primaryHeads = ocr ? readHeadFields(ocr.data.suggestions, goodsPhoto) : [];
    const parcelLabel = goodsPhoto && primaryHeads.some(read => read.field === "paketdienst" || read.field === "sendungsnummer" && /\d/u.test(read.value));
    const kind = mail ? recognizeCaptureDocument({ text: mail.body }).kind
      : xmlResult?.code === "OK" ? "rechnung" : parcelLabel ? "ware"
      : ocr ? recognizeCaptureDocument({ text: null, suggestions: ocr.data.suggestions }).kind : null;
    const models = settings?.erkennung_modelle;
    const specialistModel = ocr && models && !officeFormat
      ? kind === "rechnung" ? models.rechnung : kind === "quittung" ? models.bon : null : null;
    const specialist = specialistModel ? await readModel(specialistModel, false) : null;
    const specialistOcr = specialist?.result.code === "OK" ? specialist.result : null;
    const specialistArchiveFailed = specialistOcr !== null && !specialist?.rawPath;
    const primaryPositions = ocr?.original ? readAzurePositionRows(ocr.original.tables) : [];
    const positionRows = primaryPositions.length || !specialistOcr?.original
      ? primaryPositions : readAzurePositionRows(specialistOcr.original.tables);
    const belegart = istBelegart(kind) ? kind : null;
    await withPrivilegedTenantTransaction(auth, async tx => {
      if (belegart) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(
        'intake-belegidentitaet:'||${tenantId}||':'||${belegart},0))`);
      if (positionRows.length > 0) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${file.item_id},0))`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-file:'||${auth.tenantId}||':'||${fileId},0))`);
      const active=await tx.execute<{befehl_id:string}>(sql`SELECT befehl_id::text FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${file.item_id}::uuid
        AND art='einsatz' AND nachher->>'action'='erkennung_gestartet' AND nachher->>'fileId'=${fileId} ORDER BY zeit DESC,id DESC LIMIT 1`);
      if(active[0]?.befehl_id!==claimKey){console.info('[INTAKE_RECOGNITION_SUPERSEDED]',{fileId});return;}
      const hasValues=mail!==null||ocr!==null||xmlResult?.code==='OK';
      const documentText = mail?.body ?? ocr?.data.suggestions.find(suggestion => suggestion.field === "DOCUMENT_TEXT")?.value ?? null;
      const replaceDocumentText = mail !== null || ocr !== null && (documentText !== null || !rawStorageFailed);
      const pages = ocr?.original?.pages ?? null;
      const language = ocr?.original?.language ?? null;
      const model = ocr?.original?.model ?? null;
      const complete = ocrDisabled || hasValues && !rawStorageFailed && !specialistArchiveFailed;
      await tx.execute(sql`UPDATE public.intake_file SET lesbar=${canRead && !ocrDisabled && !ocrSettingMissing},erkennung_status=${complete ? "fertig" : "fehler"},
          foto_art=CASE WHEN ${parcelLabel} THEN coalesce(foto_art,'etikett') ELSE foto_art END,
          erkannter_text=CASE WHEN ${replaceDocumentText} THEN ${documentText} ELSE erkannter_text END, seiten=coalesce(${pages},seiten),
          sprache=coalesce(${language},sprache),
          erkennung_roh_pfad=CASE WHEN ${rawStorageFailed} THEN NULL ELSE coalesce(${rawPath},erkennung_roh_pfad) END
        WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid`);
      if(hasValues)await tx.execute(sql`UPDATE public.intake_suggestion SET status='verworfen' WHERE tenant_id=${auth.tenantId} AND file_id=${fileId}::uuid AND status='offen' AND geprueft_am IS NULL`);
      const primarySuggestions=ocr?[...documentSuggestions(ocr.data.suggestions), ...primaryHeads]:[];
      const primaryKeys=new Set(primarySuggestions.map(suggestionKey));
      const specialistSuggestions=specialistOcr?[...documentSuggestions(specialistOcr.data.suggestions), ...readHeadFields(specialistOcr.data.suggestions, goodsPhoto)].filter(suggestion=>{
        const key=suggestionKey(suggestion);
        if(primaryKeys.has(key))return false;
        primaryKeys.add(key);
        return true;
      }):[];
      const existingPositions = positionRows.length === 0 ? [] : await tx.execute<{
        fileId: string; positionKey: string; tableIndex: string | null; rowIndex: string | null;
      }>(sql`SELECT file_id::text AS "fileId", wert->>'positionKey' AS "positionKey",
          fundstelle->>'tableIndex' AS "tableIndex", fundstelle->>'rowIndex' AS "rowIndex"
        FROM public.intake_suggestion WHERE tenant_id=${auth.tenantId} AND item_id=${file.item_id}::uuid
          AND feld='position' AND wert->>'positionKey' ~ '^p[1-9][0-9]*$'`);
      let lastPositionNumber = 0;
      const storedPositionKeys = new Map<string, string>();
      for (const entry of existingPositions) {
        const number = Number(entry.positionKey.slice(1));
        if (!Number.isSafeInteger(number)) throw Error('INTAKE_POSITION_NUMBER_INVALID');
        lastPositionNumber = Math.max(lastPositionNumber, number);
        if (entry.fileId === fileId && entry.tableIndex !== null && entry.rowIndex !== null) {
          storedPositionKeys.set(`${entry.tableIndex}:${entry.rowIndex}`, entry.positionKey);
        }
      }
      const positionSuggestions = positionRows.map(({ position, confidence, source }) => {
        const row = `${source.tableIndex}:${source.rowIndex}`;
        const positionKey = storedPositionKeys.get(row) ?? `p${++lastPositionNumber}`;
        return { field: 'position', value: { ...position, positionKey }, confidence, source,
          model: primaryPositions.length ? model : specialistOcr?.original?.model ?? null };
      });
      const suggestions = mailReading && mailHasValues ? [{ field: 'mail.text', value: mailReading, confidence: null, source: { format: 'EML' }, model: null }]
        : xmlResult?.code === 'OK' ? xmlResult.suggestions.map(suggestion=>({...suggestion,model:null})) : [
        ...primarySuggestions.map(suggestion=>({...suggestion,model})),
        ...specialistSuggestions.map(suggestion=>({...suggestion,model:specialistOcr?.original?.model??null})),
      ];
      const widerspruch=pdfResult?.code==='OK'?pdfResult.widerspruch:null;
      const widerspruchsbeleg=widerspruch?[{field:'rechnung.abgleich',value:{xml:widerspruch.xml,pdf:widerspruch.pdf},confidence:null,model:null,
        source:{format:'ZUGFeRD',page:widerspruch.page}}]:[];
      const muster = findeVerdachtsmuster(documentText ?? '', settings?.eingang_verdacht_muster ?? []);
      const verdacht = muster.length ? [{field:'text.verdacht',value:{muster},confidence:null,model:null,
        source:mail ? {format:'EML'} : {page:null}}] : [];
      const ports = kontext.kandidaten;
      let firmendaten: ReturnType<KandidatenPorts['firma']> | undefined;
      const leseFirma = () => firmendaten ??= ports?.firma(tenantId) ?? Promise.resolve(null);
      const firma = suggestions.some(suggestion => istLieferantenwert(suggestion.field))
        ? await leseFirma().catch(() => {
          recordObservedFailure('INTAKE_COMPANY_IDENTITY_UNAVAILABLE');
          return null;
        }) : null;
      for (const suggestion of [...suggestions, ...positionSuggestions, ...widerspruchsbeleg, ...verdacht]) {
        const confidence = suggestion.confidence;
        const eigeneFirma = istEigenerLieferantenwert(suggestion, firma);
        const certainty = suggestion.field==='rechnung.abgleich' || suggestion.field==='text.verdacht' ? 'unsicher' : confidence === null || threshold === null
          ? 'vorschlag' : confidence >= threshold ? 'sicher' : 'unsicher';
        const regel = eigeneFirma ? 'HC3' : suggestion.field==='text.verdacht' ? 'HC4' : mail ? 'mail' : 'datei';
        const grund = eigeneFirma ? eingangCopy.eigeneFirma : suggestion.field==='text.verdacht' ? eingangCopy.verdaechtigerText
          : suggestion.field==='rechnung.abgleich' ? eingangCopy.rechnungswiderspruch
            : mail ? 'Signal im Originaltext' : xmlResult?.code==='OK' ? 'Strukturiertes XML' : 'Dokumenterkennung';
        const jsonValue = JSON.stringify(suggestion.value);
        const source = { ...suggestion.source, seite: file.reihenfolge };
        await tx.execute(sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,file_id,feld,wert,sicherheit,sicherheit_wert,modell,regel,grund,fundstelle,status)
            SELECT ${auth.tenantId},${file.item_id}::uuid,${fileId}::uuid,${suggestion.field},${jsonValue}::jsonb,${certainty},${confidence},${suggestion.model},${regel},${grund},${JSON.stringify(source)}::jsonb,${eigeneFirma ? 'verworfen' : 'offen'}
          WHERE NOT EXISTS(SELECT 1 FROM public.intake_suggestion WHERE tenant_id=${auth.tenantId} AND file_id=${fileId}::uuid
            AND feld=${suggestion.field} AND (feld<>'position' OR wert->>'positionKey'=(${jsonValue}::jsonb)->>'positionKey')
            AND geprueft_am IS NOT NULL AND status<>'verworfen')`);
      }
      const documentConcern = kind === null ? null : concernForCaptureKind(kind);
      const concerns = mail ? recognizeNoteConcerns((mail.subject??'')+'\n'+mail.body,'mail').map(row=>row.id)
        : documentConcern === null ? [] : [documentConcern];
      for (const concern of concerns) if (!onlyInvoiceAccess || concern === "rechnung") await tx.execute(sql`UPDATE public.intake_item
        SET anliegen=array_append(anliegen,${concern}::text),
          anliegen_offen=CASE WHEN ${concern}::text=ANY(anliegen_offen) THEN anliegen_offen ELSE array_append(anliegen_offen,${concern}::text) END,
          version=version+1, geaendert_von=${akteur}::uuid, geaendert_am=statement_timestamp(), updated_at=statement_timestamp()
        WHERE tenant_id=${auth.tenantId} AND id=${file.item_id}::uuid AND NOT (${concern}::text=ANY(anliegen))`);
      const recognitionCode = mail || xmlResult?.code === 'OK' ? 'OK' : isXml ? 'UNSUPPORTED_XML'
        : ocrDisabled ? 'AUSGESCHALTET' : ocrSettingMissing ? 'IN_KLAERUNG'
        : rawStorageFailed || specialistArchiveFailed ? 'INTAKE_RAW_NOT_SAVED'
        : specialist && !specialistOcr ? 'TEILWEISE'
        : recognized?.code ?? (bytes.byteLength > 20 * 1024 * 1024 ? 'INTAKE_RECOGNITION_TOO_LARGE' : 'UNSUPPORTED_DOCUMENT_TYPE');
      const receiptKey = recognitionReceiptKey(fileId, retryKey);
      let kandidaten: 'ok' | 'teilweise' | 'keine' | undefined;
      if (ports) {
        try {
          kandidaten = await withTenantSavepoint(tx, async nested => {
            const stand = settings ?? await einstellungen(nested, tenantId);
            const { eingang_vorschlaege_max, eingang_kandidat_stufen, ki_sicherheitsschwelle } = stand;
            if (eingang_vorschlaege_max == null || eingang_kandidat_stufen == null) return 'keine';
            return sucheKandidatenInTransaction(nested, { tenantId, akteur }, file.item_id, receiptKey,
              { eingang_vorschlaege_max, eingang_kandidat_stufen, ki_sicherheitsschwelle }, {...ports,firma:leseFirma});
          });
        } catch {
          kandidaten = 'teilweise';
          recordObservedFailure('INTAKE_CANDIDATES_FAILED');
        }
      }
      if (belegart && recognitionCode === 'OK') {
        try {
          await withTenantSavepoint(tx, async nested => {
            await nested.execute(sql`SET LOCAL statement_timeout='2000ms'`);
            await schlageBelegidentitaetVor(nested, {tenantId,fileId,art:belegart});
          });
        } catch {
          kandidaten = 'teilweise';
          recordObservedFailure('INTAKE_DOCUMENT_IDENTITY_FAILED');
        }
      }
      const receipt = { fileId, kind, modelle: [model,specialistModel].filter((name):name is string=>name!==null),
        code: recognitionCode, textGekuerzt: mail?.truncated ?? false, ...(kandidaten ? { kandidaten } : {}) };
      await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
        SELECT ${auth.tenantId},${file.item_id}::uuid,'erkannt',${receiptKey}::uuid,${akteur},${JSON.stringify(receipt)}::jsonb
        WHERE NOT EXISTS(SELECT 1 FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${file.item_id}::uuid AND art='erkannt' AND befehl_id=${receiptKey}::uuid)`);
      // H6b: Lagerbeleg vorbereiten
    });
  } catch (error) {
    await recordIntakeRecognitionFailure(auth, akteur, fileId, retryKey, claimOwned);
    throw error;
  }
}

export async function recordIntakeRecognitionFailure(auth: { tenantId: string }, akteur: string, fileId: string, retryKey?: string, claimOwned=false) {
  const claimKey=recognitionClaimKey(retryKey??fileId);
  const receiptKey=claimOwned ? recognitionReceiptKey(fileId, retryKey) : recognitionClaimKey('input-failure:'+(retryKey??fileId));
    recordObservedFailure('INTAKE_FILE_FINISH_FAILED');
    try {
      await withPrivilegedTenantTransaction(auth,async tx=>{
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-file:'||${auth.tenantId}||':'||${fileId},0))`);
        const changed=await tx.execute(sql`UPDATE public.intake_file file SET erkennung_status='fehler' WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid
          AND (erkennung_status='wartet' OR erkennung_status='laeuft' AND ${claimOwned} AND (SELECT event.befehl_id FROM public.intake_event event
            WHERE event.tenant_id=file.tenant_id AND event.item_id=file.item_id AND event.art='einsatz' AND event.nachher->>'action'='erkennung_gestartet' AND event.nachher->>'fileId'=file.id::text ORDER BY event.zeit DESC,event.id DESC LIMIT 1)=${claimKey}::uuid) RETURNING id`);
        if(changed.length)await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
          SELECT ${auth.tenantId},item_id,'erkannt',${receiptKey}::uuid,${akteur},${JSON.stringify({fileId,kind:null,modelle:[],code:"INTAKE_FILE_FINISH_FAILED",textGekuerzt:false})}::jsonb
          FROM public.intake_file WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid
          ON CONFLICT DO NOTHING`);
      });
    } catch{recordObservedFailure('INTAKE_FILE_FAILURE_RECORD_FAILED');}
}
