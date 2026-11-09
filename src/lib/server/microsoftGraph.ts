import "server-only";
import {createHash} from "node:crypto";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const TOKEN_SCOPE = "https://graph.microsoft.com/.default";
const REQUIRED_ENV = [
  "MS_GRAPH_TENANT_ID",
  "MS_GRAPH_CLIENT_ID",
  "MS_GRAPH_CLIENT_SECRET",
  "MS_GRAPH_MAILBOX",
] as const;

type FetchPort = typeof fetch;
type Environment = Record<string, string | undefined>;

export type GraphConfigurationStatus =
  | { code: "READY" }
  | { code: "IN_KLAERUNG"; missing: string[] };

type GraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  mailbox: string;
};

export type GraphInboxMessage = {
  id: string;
  internetMessageId: string | null;
  subject: string;
  senderName: string;
  senderAddress: string;
  receivedAt: string;
  preview: string;
  body: string;
  hasAttachments: boolean | null;
};

export type GraphMailAttachment = {
  filename: string;
  contentType: "application/pdf";
  bytes: Uint8Array;
};
export type GraphInboxAttachment = {
  id: string;
  filename: string;
  contentType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  bytes: Uint8Array;
};

type GraphResult<T> =
  | { code: "OK"; data: T }
  | { code: "IN_KLAERUNG"; message: string }
  | { code: "UNAVAILABLE"; message: string };

class GraphProviderError extends Error {
  constructor(readonly safeCode: string) {
    super(safeCode);
  }
}

function logMicrosoftGraphFailure(code: string, error: unknown) {
  console.error(`[${code}]`, error instanceof Error ? error.message : "UNKNOWN_ERROR");
}

function safeProviderCode(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "UNKNOWN";
  const error = (payload as Record<string, unknown>).error;
  const code = typeof error === "string"
    ? error
    : error && typeof error === "object" && !Array.isArray(error)
      ? (error as Record<string, unknown>).code
      : null;
  return typeof code === "string" && /^[A-Za-z0-9_.-]{1,120}$/.test(code) ? code : "UNKNOWN";
}

async function providerFailure(response: Response, operation: string): Promise<never> {
  const payload = await response.clone().json().catch((error) => {
    logMicrosoftGraphFailure("MICROSOFT_GRAPH_ERROR_PAYLOAD_INVALID", error);
    return null;
  });
  throw new GraphProviderError(`${operation}_${response.status}_${safeProviderCode(payload)}`);
}

function unavailable(message: string, error: unknown): GraphResult<never> {
  logMicrosoftGraphFailure("MICROSOFT_GRAPH_UNAVAILABLE", error);
  return {
    code: "UNAVAILABLE",
    message: error instanceof GraphProviderError ? `${message} Fehlercode: ${error.safeCode}.` : message,
  };
}

function value(env: Environment, name: (typeof REQUIRED_ENV)[number]) {
  const result = env[name]?.trim();
  return result ? result : null;
}

export function readMicrosoftGraphConfigurationStatus(
  env: Environment = process.env,
): GraphConfigurationStatus {
  const missing = REQUIRED_ENV.filter((name) => !value(env, name));
  return missing.length ? { code: "IN_KLAERUNG", missing: [...missing] } : { code: "READY" };
}

function readConfig(env: Environment): GraphConfig | null {
  if (readMicrosoftGraphConfigurationStatus(env).code !== "READY") return null;
  return {
    tenantId: value(env, "MS_GRAPH_TENANT_ID")!,
    clientId: value(env, "MS_GRAPH_CLIENT_ID")!,
    clientSecret: value(env, "MS_GRAPH_CLIENT_SECRET")!,
    mailbox: value(env, "MS_GRAPH_MAILBOX")!,
  };
}

async function accessToken(config: GraphConfig, fetchPort: FetchPort): Promise<string> {
  const response = await fetchPort(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "client_credentials",
        scope: TOKEN_SCOPE,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) await providerFailure(response, "GRAPH_TOKEN");
  const payload = (await response.json()) as { access_token?: unknown };
  if (typeof payload.access_token !== "string" || payload.access_token.length < 20) {
    throw new Error("GRAPH_TOKEN_INVALID");
  }
  return payload.access_token;
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\0/g, "").trim().slice(0, max) : "";
}

function parseMessage(value: unknown): GraphInboxMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const sender = row.from && typeof row.from === "object" && !Array.isArray(row.from)
    ? (row.from as Record<string, unknown>).emailAddress
    : null;
  const address = sender && typeof sender === "object" && !Array.isArray(sender)
    ? sender as Record<string, unknown>
    : {};
  const body = row.body && typeof row.body === "object" && !Array.isArray(row.body)
    ? row.body as Record<string, unknown>
    : {};
  const id = clean(row.id, 1024);
  const senderAddress = clean(address.address, 320).toLowerCase();
  const receivedAt = clean(row.receivedDateTime, 64);
  if (!id || !senderAddress || !/^\S+@\S+\.\S+$/.test(senderAddress) || !Number.isFinite(Date.parse(receivedAt))) return null;
  return {
    id,
    internetMessageId: clean(row.internetMessageId, 1024) || null,
    subject: clean(row.subject, 500) || "Ohne Betreff",
    senderName: clean(address.name, 300) || senderAddress,
    senderAddress,
    receivedAt: new Date(receivedAt).toISOString(),
    preview: clean(row.bodyPreview, 1000),
    body: clean(body.content, 20_000),
    hasAttachments: row.hasAttachments === true,
  };
}

async function graphGetMessage(
  config: GraphConfig,
  token: string,
  path: string,
  fetchPort: FetchPort,
): Promise<Response> {
  return fetchPort(`${GRAPH_ROOT}/users/${encodeURIComponent(config.mailbox)}/${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      prefer: 'outlook.body-content-type="text"',
    },
    cache: "no-store",
  });
}

export async function listMicrosoftGraphInbox(
  env: Environment = process.env,
  fetchPort: FetchPort = fetch,
): Promise<GraphResult<GraphInboxMessage[]>> {
  const config = readConfig(env);
  if (!config) return { code: "IN_KLAERUNG", message: "Microsoft 365 ist noch nicht für die Preview verbunden." };
  try {
    const token = await accessToken(config, fetchPort);
    const query = new URLSearchParams({
      "$top": "20",
      "$orderby": "receivedDateTime desc",
      "$select": "id,internetMessageId,subject,from,receivedDateTime,bodyPreview,body,hasAttachments",
    });
    const response = await graphGetMessage(config, token, `mailFolders/inbox/messages?${query}`, fetchPort);
    if (!response.ok) await providerFailure(response, "GRAPH_INBOX");
    const payload = (await response.json()) as { value?: unknown };
    if (!Array.isArray(payload.value)) throw new Error("GRAPH_INBOX_INVALID");
    return { code: "OK", data: payload.value.map(parseMessage).filter((item): item is GraphInboxMessage => item !== null) };
  } catch (error) {
    return unavailable("Der Outlook-Posteingang ist momentan nicht sicher erreichbar.", error);
  }
}

export async function readMicrosoftGraphMessage(
  messageId: string,
  env: Environment = process.env,
  fetchPort: FetchPort = fetch,
): Promise<GraphResult<GraphInboxMessage>> {
  const config = readConfig(env);
  if (!config) return { code: "IN_KLAERUNG", message: "Microsoft 365 ist noch nicht für die Preview verbunden." };
  if (!messageId || messageId.length > 1024) return { code: "UNAVAILABLE", message: "Die Mailkennung ist ungültig." };
  try {
    const token = await accessToken(config, fetchPort);
    const query = new URLSearchParams({ "$select": "id,internetMessageId,subject,from,receivedDateTime,bodyPreview,body,hasAttachments" });
    const response = await graphGetMessage(config, token, `messages/${encodeURIComponent(messageId)}?${query}`, fetchPort);
    if (!response.ok) await providerFailure(response, "GRAPH_MESSAGE");
    const message = parseMessage(await response.json());
    if (!message || message.id !== messageId) throw new Error("GRAPH_MESSAGE_INVALID");
    return { code: "OK", data: message };
  } catch (error) {
    return unavailable("Die Outlook-Mail ist momentan nicht sicher erreichbar.", error);
  }
}

export async function sendMicrosoftGraphMail(
  input: { to: string; subject: string; body: string; attachment?: GraphMailAttachment; replyToMessageId?: string; sendKey?:string },
  env: Environment = process.env,
  fetchPort: FetchPort = fetch,
): Promise<GraphResult<{ accepted: true }>> {
  const config = readConfig(env);
  if (!config) return { code: "IN_KLAERUNG", message: "Microsoft 365 ist noch nicht für die Preview verbunden." };
  if(input.sendKey!==undefined&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.sendKey))return {code:'UNAVAILABLE',message:'Versandkennung ist ungültig.'};
  try {
    const token = await accessToken(config, fetchPort);
    const attachments = input.attachment ? [{
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: input.attachment.filename,
      contentType: input.attachment.contentType,
      contentBytes: Buffer.from(input.attachment.bytes).toString("base64"),
    }] : undefined;
    const endpoint = input.replyToMessageId
      ? `${GRAPH_ROOT}/users/${encodeURIComponent(config.mailbox)}/messages/${encodeURIComponent(input.replyToMessageId)}/reply`
      : `${GRAPH_ROOT}/users/${encodeURIComponent(config.mailbox)}/sendMail`;
    const response = await fetchPort(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: "Text", content: input.body },
          toRecipients: [{ emailAddress: { address: input.to } }],
          ...(input.sendKey?{internetMessageHeaders:[{name:'x-kreile-send-id',value:input.sendKey}]}:{}),
          ...(attachments ? { attachments } : {}),
        },
        ...(!input.replyToMessageId ? { saveToSentItems: true } : {}),
      }),
      cache: "no-store",
    });
    if (response.status !== 202) await providerFailure(response, "GRAPH_SEND");
    return { code: "OK", data: { accepted: true } };
  } catch (error) {
    return unavailable("Die E-Mail konnte nicht sicher an Microsoft 365 übergeben werden.", error);
  }
}

/** Same Sent Items transport as AF9. An incomplete or ambiguous result never proves absence. */
export async function readMicrosoftGraphSentMailEvidence(input:{sendKey:string;recipient:string;preparedAt:string},env:Environment=process.env,fetchPort:FetchPort=fetch):Promise<GraphResult<{state:'found';graphMessageId:string;internetMessageId:string;sentAt:string}|{state:'not-found'}>>{
 const config=readConfig(env);
 if(!config)return {code:'IN_KLAERUNG',message:'Microsoft 365 ist noch nicht für die Preview verbunden.'};
 if(!/^[0-9a-f-]{36}$/i.test(input.sendKey)||!/^\S+@\S+\.\S+$/.test(input.recipient)||!Number.isFinite(Date.parse(input.preparedAt)))return {code:'UNAVAILABLE',message:'Versandbeleg ist unvollständig.'};
 const boundedFetch:FetchPort=(url,init)=>fetchPort(url,{...init,signal:AbortSignal.timeout(10000)});
 try{
  const token=await accessToken(config,boundedFetch),start=new Date(Date.parse(input.preparedAt)-60000).toISOString();
  const query=new URLSearchParams({'$top':'100','$filter':'sentDateTime ge '+start,'$select':'id,internetMessageId,internetMessageHeaders,from,toRecipients,isDraft,sentDateTime'});
  const response=await graphGetMessage(config,token,'mailFolders/sentitems/messages?'+query,boundedFetch);
  if(!response.ok)await providerFailure(response,'GRAPH_SENT_RECONCILE');
  const payload=await response.json() as {value?:unknown;'@odata.nextLink'?:unknown};
  if(!Array.isArray(payload.value)||payload['@odata.nextLink'])throw Error('GRAPH_SENT_RECONCILE_INCOMPLETE');
  const matches=payload.value.filter((value:unknown)=>{
   if(!value||typeof value!=='object')throw Error('GRAPH_SENT_RECONCILE_INVALID');
   const row=value as Record<string,unknown>;
   if(!Array.isArray(row.internetMessageHeaders))throw Error('GRAPH_SENT_HEADERS_MISSING');
   return row.internetMessageHeaders.some((header:unknown)=>header!==null&&typeof header==='object'&&typeof (header as {name?:unknown}).name==='string'&&(header as {name:string}).name.toLowerCase()==='x-kreile-send-id'&&(header as {value?:unknown}).value===input.sendKey);
  }) as Array<Record<string,unknown>>;
  if(matches.length===0)return {code:'OK',data:{state:'not-found'}};
  if(matches.length!==1)throw Error('GRAPH_SENT_RECONCILE_AMBIGUOUS');
  const row=matches[0],from=row.from as {emailAddress?:{address?:unknown}}|undefined,recipients=Array.isArray(row.toRecipients)?row.toRecipients as Array<{emailAddress?:{address?:unknown}}>:[];
  if(typeof row.id!=='string'||!row.id||typeof row.internetMessageId!=='string'||!/^<[^<>\s]+>$/.test(row.internetMessageId)||row.isDraft!==false||typeof row.sentDateTime!=='string'||!Number.isFinite(Date.parse(row.sentDateTime))||Date.parse(row.sentDateTime)<Date.parse(start)||typeof from?.emailAddress?.address!=='string'||from.emailAddress.address.toLowerCase()!==config.mailbox.toLowerCase()||!recipients.some(value=>typeof value.emailAddress?.address==='string'&&value.emailAddress.address.toLowerCase()===input.recipient.toLowerCase()))throw Error('GRAPH_SENT_RECONCILE_IDENTITY_INVALID');
  return {code:'OK',data:{state:'found',graphMessageId:row.id,internetMessageId:row.internetMessageId,sentAt:new Date(row.sentDateTime).toISOString()}};
 }catch(error){return unavailable('Der Versand wird noch geprüft.',error);}
}

export async function readMicrosoftGraphAttachments(
  messageId: string,
  env: Environment = process.env,
  fetchPort: FetchPort = fetch,
): Promise<GraphResult<{ attachments: GraphInboxAttachment[]; skipped: number }>> {
  const config = readConfig(env);
  if (!config) return { code: "IN_KLAERUNG", message: "Microsoft 365 ist noch nicht für die Preview verbunden." };
  if (!messageId || messageId.length > 1024) return { code: "UNAVAILABLE", message: "Die Mailkennung ist ungültig." };
  try {
    const token = await accessToken(config, fetchPort);
    const response = await graphGetMessage(config, token, `messages/${encodeURIComponent(messageId)}/attachments`, fetchPort);
    if (!response.ok) await providerFailure(response, "GRAPH_ATTACHMENTS");
    const payload = await response.json() as { value?: unknown };
    if (!Array.isArray(payload.value)) throw new Error("GRAPH_ATTACHMENTS_INVALID");
    const attachments: GraphInboxAttachment[] = [];
    let skipped = 0;
    let total = 0;
    for (const entry of payload.value.slice(0, 20)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) { skipped += 1; continue; }
      const row = entry as Record<string, unknown>;
      const contentType = clean(row.contentType, 100);
      const encoded = typeof row.contentBytes === "string" ? row.contentBytes : "";
      const allowed = contentType === "application/pdf" || contentType === "image/jpeg" || contentType === "image/png" || contentType === "image/webp";
      if (!allowed || !encoded || typeof row.id !== "string") { skipped += 1; continue; }
      const bytes = new Uint8Array(Buffer.from(encoded, "base64"));
      const size = typeof row.size === "number" ? row.size : bytes.byteLength;
      const namedSignature = /(?:^|[_. -])(?:logo|signature|signatur)(?:[_. -]|$)/iu.test(typeof row.name === "string" ? row.name : "");
      const signatureImage = contentType.startsWith("image/") && ((bytes.byteLength < 10 * 1024 && (row.isInline === true || namedSignature)) || (row.isInline === true && typeof row.contentId === "string" && row.contentId.length > 0 && namedSignature));
      if (signatureImage) { skipped += 1; continue; }
      total += bytes.byteLength;
      if (bytes.byteLength < 1 || bytes.byteLength > 20 * 1024 * 1024 || total > 40 * 1024 * 1024 || size !== bytes.byteLength) { skipped += 1; continue; }
      attachments.push({ id: row.id, filename: clean(row.name, 120) || `Mailanhang-${attachments.length + 1}`, contentType, bytes });
    }
    skipped += Math.max(0, payload.value.length - 20);
    return { code: "OK", data: { attachments, skipped } };
  } catch (error) {
    return unavailable("Die Mailanhänge sind momentan nicht sicher erreichbar.", error);
  }
}

/** Preserve the provider's MIME bytes; never synthesize an email original from its preview. */
export async function readMicrosoftGraphMime(messageId:string,env:Environment=process.env,fetchPort:FetchPort=fetch):Promise<GraphResult<Uint8Array>> {
  const config=readConfig(env);
  if(!config)return {code:"IN_KLAERUNG",message:"Microsoft 365 ist noch nicht für die Preview verbunden."};
  if(!messageId||messageId.length>1024)return {code:"UNAVAILABLE",message:"Die Mailkennung ist ungültig."};
  try {
    const token=await accessToken(config,fetchPort);
    const response=await graphGetMessage(config,token,`messages/${encodeURIComponent(messageId)}/$value`,fetchPort);
    if(!response.ok)await providerFailure(response,"GRAPH_MIME");
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.byteLength<1||bytes.byteLength>20*1024*1024)throw new Error("GRAPH_MIME_SIZE_INVALID");
    return {code:"OK",data:bytes};
  }catch(error){return unavailable("Das Mail-Original konnte nicht sicher geladen werden.",error);}
}

/** Resolve a real reply target from Sent Items; no draft/send API or wider mail grant. */
export async function readMicrosoftGraphSentDocumentEvidence(
 internetMessageId:string,replySender:string,env:Environment=process.env,fetchPort:FetchPort=fetch,
):Promise<GraphResult<{graphMessageId:string;internetMessageId:string;sentAt:string;pdfSha256:string[]}>>{
 const config=readConfig(env);
 if(!config)return {code:'IN_KLAERUNG',message:'Microsoft 365 ist noch nicht für die Preview verbunden.'};
 if(!/^<[^<>\s]{1,998}>$/.test(internetMessageId)||!/^\S+@\S+\.\S+$/.test(replySender)||replySender.length>320)return {code:'UNAVAILABLE',message:'Die direkte Antwortreferenz ist nicht eindeutig lesbar.'};
 const boundedFetch:FetchPort=(input,init)=>fetchPort(input,{...init,signal:AbortSignal.timeout(10000)});
 try{
  const token=await accessToken(config,boundedFetch),query=new URLSearchParams({'$top':'2','$filter':"internetMessageId eq '"+internetMessageId.replaceAll("'","''")+"'",'$select':'id,internetMessageId,from,toRecipients,isDraft,sentDateTime,hasAttachments'});
  const response=await graphGetMessage(config,token,'mailFolders/sentitems/messages?'+query,boundedFetch);
  if(!response.ok)await providerFailure(response,'GRAPH_REPLY_SENT_TARGET');
  const payload=await response.json() as {value?:unknown;'@odata.nextLink'?:unknown};
  if(!Array.isArray(payload.value)||payload.value.length!==1||payload['@odata.nextLink'])throw Error('GRAPH_REPLY_TARGET_NOT_UNIQUE');
  const row=payload.value[0] as Record<string,unknown>;
  const from=row.from as {emailAddress?:{address?:unknown}}|undefined;
  const recipients=Array.isArray(row.toRecipients)?row.toRecipients as Array<{emailAddress?:{address?:unknown}}>:[];
  if(typeof row.id!=='string'||!row.id||row.id.length>1024||row.internetMessageId!==internetMessageId||row.isDraft!==false||typeof row.sentDateTime!=='string'||!Number.isFinite(Date.parse(row.sentDateTime))||typeof from?.emailAddress?.address!=='string'||from.emailAddress.address.trim().toLowerCase()!==config.mailbox.toLowerCase()||!recipients.some(recipient=>typeof recipient.emailAddress?.address==='string'&&recipient.emailAddress.address.trim().toLowerCase()===replySender.toLowerCase()))throw Error('GRAPH_REPLY_TARGET_IDENTITY_INVALID');
  const attachments=await readMicrosoftGraphAttachments(row.id,env,boundedFetch);
  if(attachments.code!=='OK')return attachments;
  const hashes=[...new Set(attachments.data.attachments.filter(file=>file.contentType==='application/pdf').map(file=>createHash('sha256').update(file.bytes).digest('hex')))];
  if(!hashes.length)throw Error('GRAPH_REPLY_TARGET_PDF_MISSING');
  return {code:'OK',data:{graphMessageId:row.id,internetMessageId,sentAt:new Date(row.sentDateTime).toISOString(),pdfSha256:hashes}};
 }catch(error){return unavailable('Die beantwortete KV-Mail ist nicht eindeutig mit einem gesendeten Original-PDF belegt.',error);}
}
