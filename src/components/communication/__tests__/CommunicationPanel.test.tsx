import { render, screen, waitFor,fireEvent,cleanup } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunicationPanel } from "../CommunicationPanel";

const actions = vi.hoisted(() => ({
  getStatus: vi.fn(),
  importMail: vi.fn(),
  request: vi.fn(),
  listGlobal: vi.fn(),
  attach: vi.fn(),
  send: vi.fn(),
  listQuotes: vi.fn(),
}));

vi.mock("@/app/actions/communications.actions", () => ({
  getMicrosoftGraphStatusAction: actions.getStatus,
  importOutlookMailAction: actions.importMail,
  listOutlookInboxAction: actions.listGlobal,
  attachOutlookMailAction: actions.attach,
  sendCustomerMailAction: actions.send,
}));

vi.mock("@/app/actions/quotes.actions", () => ({
  listOpenQuotesAction: actions.listQuotes,
}));

vi.mock("@/components/layout/GlobalCreateFlow", () => ({
  requestGlobalCreate: actions.request,
}));

describe("CommunicationPanel order assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.getStatus.mockResolvedValue({ code: "OK" });
    actions.listQuotes.mockResolvedValue({ code: "OK", quotes: [] });
  });

  it("shows only locally assigned order mail and never opens the global inbox", async () => {
    actions.listGlobal.mockResolvedValue({
      code: "OK",
      data: [{
        id: "graph-requested",
        internetMessageId: null,
        subject: "Anfrage zum Auftrag",
        body: "Bitte Auftrag prüfen.",
        preview: "Bitte Auftrag prüfen.",
        senderName: "Kunde A",
        senderAddress: "kunde-a@example.test",
        receivedAt: "2026-10-29T16:30:00.000Z",
        hasAttachments: null,
      }],
    });
    render(<CommunicationPanel targetType="ORDER" targetId="order-a" />);

    expect(await screen.findByText("Anfrage zum Auftrag")).toBeInTheDocument();
    expect(screen.getByText("Bitte Auftrag prüfen.")).toBeInTheDocument();
    expect(screen.queryByText("Unzustellbar fremder Auftrag")).not.toBeInTheDocument();
    expect(actions.listGlobal).toHaveBeenCalledTimes(1);
    expect(actions.listGlobal).toHaveBeenCalledWith({ targetType: "ORDER", targetId: "order-a" });
  });

  it("shows an honest empty state when no mail is assigned to the order", async () => {
    actions.listGlobal.mockResolvedValue({ code: "OK", data: [] });

    render(<CommunicationPanel targetType="ORDER" targetId="order-empty" />);

    await waitFor(() => expect(screen.getByText("Diesem Auftrag sind keine Mails zugeordnet.")).toBeInTheDocument());
  });
});

it('locks duplicate submits, preserves an unclear mail intent and retries with the exact same key and body',async()=>{
 cleanup();actions.getStatus.mockResolvedValue({code:'OK'});actions.listQuotes.mockResolvedValue({code:'OK',quotes:[]});actions.listGlobal.mockResolvedValue({code:'OK',data:[]});
 actions.send.mockRejectedValueOnce(new Error('TEST interrupted response')).mockResolvedValueOnce({code:'OK',data:{},notice:'TEST Mail gesendet · KV-Stand bitte prüfen'});
 render(<CommunicationPanel targetType="CUSTOMER" targetId="TEST-customer"/>);
 const send=await screen.findByRole('button',{name:'Versenden'});
 fireEvent.change(screen.getByRole('textbox',{name:'Betreff'}),{target:{value:'TEST KV'}});
 fireEvent.change(screen.getByRole('textbox',{name:'Nachricht'}),{target:{value:'TEST Originaltext'}});
 const form=send.closest('form')!;fireEvent.submit(form);fireEvent.submit(form);
 const retry=await screen.findByRole('button',{name:'Mit gleicher Kennung erneut versuchen'});
 expect(actions.send).toHaveBeenCalledTimes(1);
 expect(screen.getByRole('textbox',{name:'Nachricht'})).toBeDisabled();
 expect(screen.getByRole('textbox',{name:'Nachricht'})).toHaveValue('TEST Originaltext');
 const original=actions.send.mock.calls[0][0];fireEvent.click(retry);
 await screen.findByText('TEST Mail gesendet · KV-Stand bitte prüfen');
 expect(actions.send.mock.calls[1][0]).toEqual(original);
 expect(screen.getByRole('textbox',{name:'Nachricht'})).toHaveValue('');
});

it('requires an explicit click on the server-qualified resend label and retains the original request',async()=>{
 cleanup();actions.getStatus.mockResolvedValue({code:'OK'});actions.listQuotes.mockResolvedValue({code:'OK',quotes:[]});actions.listGlobal.mockResolvedValue({code:'OK',data:[]});
 const requestId='aa212121-1111-4111-8111-222222222222',label='Mail an TEST Kunde erneut senden – nicht im Postausgang gefunden';
 actions.send.mockResolvedValueOnce({code:'CONFLICT',message:'Versand unklar',resend:{requestId,label}}).mockResolvedValueOnce({code:'OK',data:{}});
 render(<CommunicationPanel targetType="CUSTOMER" targetId="TEST-customer"/>);
 const send=await screen.findByRole('button',{name:'Versenden'});
 fireEvent.change(screen.getByRole('textbox',{name:'Betreff'}),{target:{value:'TEST Betreff'}});
 fireEvent.change(screen.getByRole('textbox',{name:'Nachricht'}),{target:{value:'TEST Original bleibt'}});
 fireEvent.click(send);
 const confirm=await screen.findByRole('button',{name:label});
 expect(actions.send).toHaveBeenCalledTimes(1);expect(actions.send.mock.calls[0][0]).not.toHaveProperty('confirmedResend');
 fireEvent.click(confirm);
 await waitFor(()=>expect(actions.send).toHaveBeenCalledTimes(2));
 expect(actions.send.mock.calls[1][0]).toMatchObject({clientRequestId:requestId,confirmedResend:true,subject:'TEST Betreff',body:'TEST Original bleibt'});
});

it('starts capture only with a secured canonical mail source and keeps a failed import on screen',async()=>{
 cleanup();actions.getStatus.mockResolvedValue({code:'OK'});actions.listQuotes.mockResolvedValue({code:'OK',quotes:[]});
 actions.listGlobal.mockResolvedValue({code:'OK',data:[{id:'TEST-mail',subject:'TEST Mail',body:'TEST Auftrag',preview:'TEST Auftrag',senderName:'TEST Kunde',senderAddress:'test@example.invalid',receivedAt:'2026-11-07T10:00:00Z',hasAttachments:true}]});
 actions.importMail.mockResolvedValueOnce({code:'UNAVAILABLE',message:'TEST Original fehlt'}).mockResolvedValueOnce({code:'OK',itemId:'TEST-intake'});
 render(<CommunicationPanel targetType="CUSTOMER" targetId="TEST-customer"/>);
 fireEvent.click(await screen.findByRole('button',{name:'KV anlegen'}));
 expect(await screen.findByText('TEST Original fehlt')).toBeInTheDocument();expect(actions.request).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'KV anlegen'}));
 await waitFor(()=>expect(actions.request).toHaveBeenCalledWith({intent:'QUOTE',prefill:{sourceItemId:'TEST-intake',customerQuery:'test@example.invalid',note:'TEST Auftrag'}}));
});

it('uses the existing normal send control for a legacy new PREPARE without a resend flag',async()=>{
 cleanup();actions.getStatus.mockResolvedValue({code:'OK'});actions.listQuotes.mockResolvedValue({code:'OK',quotes:[]});actions.listGlobal.mockResolvedValue({code:'OK',data:[]});
 const requestId='bb212121-1111-4111-8111-222222222222';
 actions.send.mockResolvedValueOnce({code:'CONFLICT',message:'TEST legacy original unavailable',newPrepare:{requestId,previousRequestId:'TEST old',checkedAt:'2026-11-11T01:00:00Z'}}).mockResolvedValueOnce({code:'OK',data:{}});
 render(<CommunicationPanel targetType="CUSTOMER" targetId="TEST-customer"/>);
 const send=await screen.findByRole('button',{name:'Versenden'});
 fireEvent.change(screen.getByRole('textbox',{name:'Betreff'}),{target:{value:'TEST Betreff'}});
 fireEvent.change(screen.getByRole('textbox',{name:'Nachricht'}),{target:{value:'TEST Original bleibt'}});
 fireEvent.click(send);await screen.findByText('TEST legacy original unavailable');
 expect(actions.send).toHaveBeenCalledTimes(1);expect(screen.queryByRole('button',{name:/erneut senden/})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Versenden'}));
 await waitFor(()=>expect(actions.send).toHaveBeenCalledTimes(2));
 expect(actions.send.mock.calls[1][0]).toMatchObject({clientRequestId:requestId,subject:'TEST Betreff',body:'TEST Original bleibt'});
 expect(actions.send.mock.calls[1][0]).not.toHaveProperty('confirmedResend');
});
