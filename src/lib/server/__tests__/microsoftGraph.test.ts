import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listMicrosoftGraphInbox,
  readMicrosoftGraphSentDocumentEvidence,
  readMicrosoftGraphAttachments,
  readMicrosoftGraphMime,
  readMicrosoftGraphConfigurationStatus,
  sendMicrosoftGraphMail,
} from "../microsoftGraph";

const env = {
  MS_GRAPH_TENANT_ID: "tenant",
  MS_GRAPH_CLIENT_ID: "client",
  MS_GRAPH_CLIENT_SECRET: "secret",
  MS_GRAPH_MAILBOX: "mailbox@example.invalid",
};

afterEach(() => vi.restoreAllMocks());

it('preserves large inline work photos and small ordinary images while excluding a signature CID',async()=>{
  const rows=[
    {id:'TEST-part',name:'TEST-Teil.png',contentType:'image/png',isInline:true,contentId:'TEST-part',size:16000,contentBytes:Buffer.alloc(16000,7).toString('base64')},
    {id:'TEST-label',name:'TEST-Etikett.png',contentType:'image/png',isInline:false,size:200,contentBytes:Buffer.alloc(200,8).toString('base64')},
    {id:'TEST-logo',name:'TEST-Signatur.png',contentType:'image/png',isInline:true,contentId:'TEST-signature',size:16000,contentBytes:Buffer.alloc(16000,9).toString('base64')},
  ];
  const fetchPort=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:'TEST-token'.repeat(5)}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({value:rows}),{status:200}));
  const result=await readMicrosoftGraphAttachments('TEST-mail',env,fetchPort);
  expect(result).toMatchObject({code:'OK',data:{skipped:1,attachments:[{id:'TEST-part'},{id:'TEST-label'}]}});
});

it('retrieves unchanged MIME bytes rather than constructing an original from body text',async()=>{
  const mime='From: TEST <test@example.invalid>\r\nMIME-Version: 1.0\r\n\r\nTEST original\r\n';
  const fetchPort=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:'TEST-token'.repeat(5)}),{status:200})).mockResolvedValueOnce(new Response(mime,{status:200}));
  const result=await readMicrosoftGraphMime('TEST/mail',env,fetchPort);
  expect(result.code).toBe('OK');if(result.code!=='OK')return;
  expect(Buffer.from(result.data).equals(Buffer.from(mime))).toBe(true);
  expect(String(fetchPort.mock.calls[1][0])).toContain('/messages/TEST%2Fmail/$value');
});

describe("Microsoft Graph port", () => {
  it("fails closed without persisting or exposing missing values", () => {
    expect(readMicrosoftGraphConfigurationStatus({})).toEqual({
      code: "IN_KLAERUNG",
      missing: ["MS_GRAPH_TENANT_ID", "MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET", "MS_GRAPH_MAILBOX"],
    });
  });

  it("reads only validated inbox messages as text", async () => {
    const fetchPort = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "a".repeat(30) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{
        id: "graph-1", internetMessageId: "internet-1", subject: "Anfrage", receivedDateTime: "2026-10-26T10:00:00Z",
        from: { emailAddress: { name: "Kunde", address: "KUNDE@example.invalid" } }, bodyPreview: "Bitte prüfen",
        body: { contentType: "text", content: "Bitte prüfen und melden." }, hasAttachments: true,
      }, { id: "invalid" }] }), { status: 200 }));
    const result = await listMicrosoftGraphInbox(env, fetchPort);
    expect(result).toEqual({ code: "OK", data: [{
      id: "graph-1", internetMessageId: "internet-1", subject: "Anfrage", senderName: "Kunde",
      senderAddress: "kunde@example.invalid", receivedAt: "2026-10-26T10:00:00.000Z", preview: "Bitte prüfen",
      body: "Bitte prüfen und melden.", hasAttachments: true,
    }] });
    expect(fetchPort.mock.calls[1]?.[1]?.headers).toMatchObject({ prefer: 'outlook.body-content-type="text"' });
  });

  it("reports only the safe provider code when Graph authentication fails", async () => {
    const fetchPort = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: "invalid_client",
      error_description: "Secret and tenant details must never reach the UI",
    }), { status: 401 }));
    await expect(listMicrosoftGraphInbox(env, fetchPort)).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Der Outlook-Posteingang ist momentan nicht sicher erreichbar. Fehlercode: GRAPH_TOKEN_401_invalid_client.",
    });
  });

  it("reports a safe Graph API code without response details", async () => {
    const fetchPort = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "a".repeat(30) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: "ErrorAccessDenied", message: "Mailbox details must never reach the UI" },
      }), { status: 403 }));
    await expect(listMicrosoftGraphInbox(env, fetchPort)).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Der Outlook-Posteingang ist momentan nicht sicher erreichbar. Fehlercode: GRAPH_INBOX_403_ErrorAccessDenied.",
    });
  });

  it("sends a PDF attachment only after Graph accepts it", async () => {
    const fetchPort = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "a".repeat(30) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const result = await sendMicrosoftGraphMail({
      to: "kunde@example.invalid", subject: "KV", body: "Anbei Ihr KV.",
      attachment: { filename: "K-2026-0001.pdf", contentType: "application/pdf", bytes: new Uint8Array([37, 80, 68, 70]) },
    }, env, fetchPort);
    expect(result).toEqual({ code: "OK", data: { accepted: true } });
    const request = JSON.parse(String(fetchPort.mock.calls[1]?.[1]?.body));
    expect(request.message.attachments[0]).toMatchObject({ name: "K-2026-0001.pdf", contentType: "application/pdf", contentBytes: "JVBERg==" });
  });

  it("reads supported non-inline inbox attachments and skips the rest", async () => {
    const fetchPort = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "a".repeat(30) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [
        { id: "a-1", name: "Anfrage.pdf", contentType: "application/pdf", contentBytes: "JVBERg==", size: 4, isInline: false },
        { id: "a-2", name: "Signatur.png", contentType: "image/png", contentBytes: "AQID", size: 3, isInline: true },
        { id: "a-3", name: "Dokument.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", contentBytes: "AQID", size: 3, isInline: false },
      ] }), { status: 200 }));
    const result = await readMicrosoftGraphAttachments("message-1", env, fetchPort);
    expect(result.code).toBe("OK");
    if (result.code !== "OK") return;
    expect(result.data.attachments).toHaveLength(1);
    expect(result.data.attachments[0]).toMatchObject({ id: "a-1", filename: "Anfrage.pdf", contentType: "application/pdf" });
    expect(result.data.skipped).toBe(2);
  });
});

it.each(['ok','ambiguous','foreign','recipient','no_pdf'] as const)('AF9 sent-document lookup verifies actual ID, sender, recipient and PDF bytes: %s',async(kind)=>{
 const internetId="<TEST-kv'edition1@example.invalid>",pdf=Buffer.from('TEST actual returned PDF bytes');
 const row={id:'TEST-sent-message',internetMessageId:internetId,from:{emailAddress:{address:kind==='foreign'?'attacker@example.invalid':env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:kind==='recipient'?'other@example.invalid':'customer@example.invalid'}}],isDraft:false,sentDateTime:'2026-11-07T10:00:00Z',hasAttachments:true};
 const fetchPort=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:'TEST-token'.repeat(5)}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({value:kind==='ambiguous'?[row,row]:[row]}),{status:200}));
 if(kind==='ok'||kind==='no_pdf')fetchPort.mockResolvedValueOnce(new Response(JSON.stringify({access_token:'TEST-token'.repeat(5)}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({value:kind==='no_pdf'?[]:[{id:'TEST-PDF',name:'TEST-KV.pdf',contentType:'application/pdf',size:pdf.length,contentBytes:pdf.toString('base64')}]}),{status:200}));
 const result=await readMicrosoftGraphSentDocumentEvidence(internetId,'customer@example.invalid',env,fetchPort);
 const requested=new URL(String(fetchPort.mock.calls[1][0]));expect(requested.pathname).toContain('/mailFolders/sentitems/messages');expect(requested.searchParams.get('$filter')).toBe("internetMessageId eq '<TEST-kv''edition1@example.invalid>'");
 if(kind==='ok'){
  const {createHash}=await import('node:crypto');expect(result).toEqual({code:'OK',data:{graphMessageId:'TEST-sent-message',internetMessageId:internetId,sentAt:'2026-11-07T10:00:00.000Z',pdfSha256:[createHash('sha256').update(pdf).digest('hex')]}});
 }else expect(result.code).toBe('UNAVAILABLE');
 expect(fetchPort.mock.calls.every(call=>!call[1]?.method||call[1].method==='GET'||String(call[0]).startsWith('https://login.microsoftonline.com/'))).toBe(true);
});


it('S05K A1 follows ascending pages up to500 and resumes the exact validated provider cursor',async()=>{
 const row=(index:number)=>({id:'TEST-page-'+index,subject:'TEST',from:{emailAddress:{address:'test@example.invalid'}},receivedDateTime:'2026-11-12T12:00:00Z',body:{content:'TEST'}});
 const requests:string[]=[];
 const fetchPort=vi.fn(async(input:Parameters<typeof fetch>[0])=>{
  const url=new URL(String(input));
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-token'.repeat(5)});
  requests.push(url.href);const offset=Number(url.searchParams.get('$skip')??0);
  return Response.json({value:Array.from({length:50},(_,i)=>row(offset+i)),'@odata.count':550,...(offset<500?{'@odata.nextLink':'https://graph.microsoft.com/v1.0/users/mailbox%40example.invalid/mailFolders/inbox/messages?$top=50&$skip='+(offset+50)}:{})});
 });
 const first=await listMicrosoftGraphInbox(env,fetchPort,{watermark:'2026-11-12T12:00:00Z',cursorUrl:null,remaining:null});
 expect(first.code).toBe('OK');if(first.code!=='OK')throw Error('TEST_A1_FIRST');
 expect(first.data).toHaveLength(500);expect(first.remaining).toBe(50);
 expect(requests).toHaveLength(10);
 expect(new URL(requests[0]).searchParams.get('$filter')).toBe('receivedDateTime ge 2026-11-12T11:55:00.000Z');
 expect(first.cursorUrl).toContain('$skip=500');
 const second=await listMicrosoftGraphInbox(env,fetchPort,{watermark:null,cursorUrl:first.cursorUrl!,remaining:first.remaining!});
 expect(second).toMatchObject({code:'OK',cursorUrl:null,remaining:0});
 if(second.code!=='OK')throw Error('TEST_A1_SECOND');expect(second.data).toHaveLength(50);
 expect(requests[10]).toBe(first.cursorUrl);
});
it('S05K A1 never forwards its token to another host or mailbox via a persisted cursor',async()=>{
 for(const cursorUrl of ['https://evil.invalid/messages','https://graph.microsoft.com/v1.0/users/other%40example.invalid/mailFolders/inbox/messages']){
  const fetchPort=vi.fn();expect(await listMicrosoftGraphInbox(env,fetchPort,{watermark:null,cursorUrl,remaining:null})).toMatchObject({code:'UNAVAILABLE'});expect(fetchPort).not.toHaveBeenCalled();
 }
});


it('S05K A2 shares the500 mail budget with persisted failures and leaves an unfetched cursor timestamp to its caller',async()=>{
 const cursorUrl='https://graph.microsoft.com/v1.0/users/mailbox%40example.invalid/mailFolders/inbox/messages?$top=50&$skip=50';
 const fetchPort=vi.fn();
 expect(await listMicrosoftGraphInbox(env,fetchPort,{watermark:null,cursorUrl,remaining:450,maxMessages:49})).toMatchObject({code:'OK',data:[],startUrl:cursorUrl,cursorUrl,remaining:450,incomplete:[]});
 expect(fetchPort).not.toHaveBeenCalled();
});
it('S05K A2 retains an incomplete list row identity for the existing full-message importer instead of silently dropping it',async()=>{
 const fetchPort=vi.fn().mockResolvedValueOnce(Response.json({access_token:'TEST-token'.repeat(5)})).mockResolvedValueOnce(Response.json({value:[{id:'TEST-missing-summary'}],'@odata.count':1}));
 expect(await listMicrosoftGraphInbox(env,fetchPort,{watermark:null,cursorUrl:null,remaining:null,maxMessages:500})).toMatchObject({code:'OK',data:[],incomplete:[{id:'TEST-missing-summary'}],cursorUrl:null});
});
