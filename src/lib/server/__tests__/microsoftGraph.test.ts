import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listMicrosoftGraphInbox,
  readMicrosoftGraphSentDocumentEvidence,
  readMicrosoftGraphSentMailEvidence,
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

it.each(['found','empty','ambiguous','foreign','incomplete','missingHeaders'] as const)('RM07 Sent Items correlation is read-only and proves only an unambiguous complete result: %s',async(kind)=>{
 const sendKey='11111111-1111-4111-8111-111111111111';
 const row={id:'TEST-sent',internetMessageId:'<TEST-sent@example.invalid>',internetMessageHeaders:[{name:'X-Kreile-Send-Id',value:sendKey}],from:{emailAddress:{address:kind==='foreign'?'foreign@example.invalid':env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:'customer@example.invalid'}}],isDraft:false,sentDateTime:'2026-11-09T04:00:00Z'};
 const payload={value:kind==='empty'?[]:kind==='ambiguous'?[row,row]:kind==='missingHeaders'?[{...row,internetMessageHeaders:undefined}]:[row],...(kind==='incomplete'?{'@odata.nextLink':'TEST-more'}:{})};
 const fetchPort=vi.fn().mockResolvedValueOnce(Response.json({access_token:'TEST-token'.repeat(5)})).mockResolvedValueOnce(Response.json(payload));
 const result=await readMicrosoftGraphSentMailEvidence({sendKey,recipient:'customer@example.invalid',preparedAt:'2026-11-09T03:59:00Z'},env,fetchPort);
 if(kind==='found')expect(result).toMatchObject({code:'OK',data:{state:'found',graphMessageId:'TEST-sent'}});
 else if(kind==='empty')expect(result).toEqual({code:'OK',data:{state:'not-found'}});
 else expect(result.code).toBe('UNAVAILABLE');
 expect(fetchPort.mock.calls[1][1]?.method).toBeUndefined();
 expect(String(fetchPort.mock.calls[1][0])).toContain('/mailFolders/sentitems/messages?');
});

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
