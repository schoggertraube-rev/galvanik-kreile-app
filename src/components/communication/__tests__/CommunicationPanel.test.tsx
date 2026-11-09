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

it('RM07 actual mail form checks automatically without a send button, then retries a confirmed failure with a new key',async()=>{
 cleanup();vi.clearAllMocks();actions.getStatus.mockResolvedValue({code:'OK'});actions.listQuotes.mockResolvedValue({code:'OK',quotes:[]});actions.listGlobal.mockResolvedValue({code:'OK',data:[]});
 actions.send.mockImplementationOnce(async()=>({code:'UNAVAILABLE',delivery:'checking',retryAt:new Date(Date.now()+150).toISOString(),message:'TEST hidden transport detail'})).mockResolvedValueOnce({code:'CONFLICT',delivery:'failed',deliveryCustomer:'TEST Schmidt',message:'TEST hidden failure detail'}).mockResolvedValueOnce({code:'OK',data:{}});
 render(<CommunicationPanel targetType="CUSTOMER" targetId="TEST-customer"/>);
 const send=await screen.findByRole('button',{name:'Versenden'});
 fireEvent.change(screen.getByRole('textbox',{name:'Betreff'}),{target:{value:'TEST RM07'}});fireEvent.change(screen.getByRole('textbox',{name:'Nachricht'}),{target:{value:'TEST Originaltext'}});
 fireEvent.click(send);await screen.findByText('Wird gerade geprüft');
 expect(screen.queryByRole('button',{name:'Versenden'})).not.toBeInTheDocument();expect(screen.queryByText('TEST hidden transport detail')).not.toBeInTheDocument();
 const retry=await screen.findByRole('button',{name:'Erneut senden'});expect(actions.send).toHaveBeenCalledTimes(2);
 expect(actions.send.mock.calls[1][0]).toEqual(actions.send.mock.calls[0][0]);expect(screen.getByDisplayValue('TEST Originaltext')).toBeEnabled();
 fireEvent.click(retry);await waitFor(()=>expect(actions.send).toHaveBeenCalledTimes(3));
 expect(actions.send.mock.calls[2][0]).toMatchObject({subject:'TEST RM07',body:'TEST Originaltext'});expect(actions.send.mock.calls[2][0].clientRequestId).not.toBe(actions.send.mock.calls[0][0].clientRequestId);
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

it('RM07 source-changed receipt requires reload and rejects another form submit',async()=>{
 cleanup();vi.clearAllMocks();actions.getStatus.mockResolvedValue({code:'OK'});actions.listQuotes.mockResolvedValue({code:'OK',quotes:[]});actions.listGlobal.mockResolvedValue({code:'OK',data:[]});
 actions.send.mockResolvedValue({code:'OK',data:{sourceChanged:true,deliveryCustomer:'TEST Schmidt'}});
 render(<CommunicationPanel targetType="CUSTOMER" targetId="TEST-customer"/>);
 const send=await screen.findByRole('button',{name:'Versenden'});const form=send.closest('form')!;
 fireEvent.change(screen.getByRole('textbox',{name:'Betreff'}),{target:{value:'TEST Quelle'}});fireEvent.change(screen.getByRole('textbox',{name:'Nachricht'}),{target:{value:'TEST Antwort'}});
 fireEvent.submit(form);
 await screen.findByText('Die Mail an TEST Schmidt ist rausgegangen. Der Vorgang wurde inzwischen geändert – lies ihn neu, die Mail steht im Verlauf.');
 expect(screen.getByRole('button',{name:'Neu laden'})).toBeEnabled();expect(screen.queryByRole('button',{name:'Versenden'})).toBeNull();
 fireEvent.change(screen.getByRole('textbox',{name:'Betreff'}),{target:{value:'TEST anderer Text'}});fireEvent.change(screen.getByRole('textbox',{name:'Nachricht'}),{target:{value:'TEST nicht erneut senden'}});
 fireEvent.submit(form);expect(actions.send).toHaveBeenCalledOnce();
});


it('restores the actual composer after full unmount and reconciles the persisted original request without sending again',async()=>{
 cleanup();vi.clearAllMocks();actions.listQuotes.mockResolvedValue({code:'OK',quotes:[]});actions.listGlobal.mockResolvedValue({code:'OK',data:[]});
 const request={targetType:'CUSTOMER',targetId:'TEST-customer',clientRequestId:crypto.randomUUID(),subject:'TEST gespeicherter Betreff',body:'TEST gespeicherte Nachricht'};
 actions.getStatus.mockResolvedValue({code:'OK'});
 actions.send.mockResolvedValueOnce({code:'UNAVAILABLE',delivery:'checking',retryAt:new Date(Date.now()+60000).toISOString()});
 const first=render(<CommunicationPanel targetType="CUSTOMER" targetId="TEST-customer"/>);
 const send=await screen.findByRole('button',{name:'Versenden'});
 fireEvent.change(screen.getByRole('textbox',{name:'Betreff'}),{target:{value:request.subject}});fireEvent.change(screen.getByRole('textbox',{name:'Nachricht'}),{target:{value:request.body}});
 fireEvent.click(send);await screen.findByText('Wird gerade geprüft');first.unmount();
 // Simulate the actual server journal read after losing every component/ref state.
 actions.getStatus.mockResolvedValue({code:'OK',recovery:{request,retryAt:new Date(Date.now()+100).toISOString()}});
 actions.send.mockResolvedValueOnce({code:'OK',data:{replayed:true}});
 render(<CommunicationPanel targetType="CUSTOMER" targetId="TEST-customer"/>);
 await screen.findByDisplayValue(request.body);expect(screen.getByDisplayValue(request.body)).toBeDisabled();
 expect(screen.queryByRole('button',{name:'Versenden'})).not.toBeInTheDocument();
 await screen.findByText('E-Mail wurde versendet und am Vorgang gespeichert.');
 expect(actions.send).toHaveBeenCalledTimes(2);expect(actions.send.mock.calls[1][0]).toEqual(request);
 expect(actions.getStatus).toHaveBeenLastCalledWith({targetType:'CUSTOMER',targetId:'TEST-customer'});
});

it('keeps a legacy unresolved send locked when its original message cannot be safely recovered',async()=>{
 cleanup();vi.clearAllMocks();actions.listQuotes.mockResolvedValue({code:'OK',quotes:[]});actions.listGlobal.mockResolvedValue({code:'OK',data:[]});
 actions.getStatus.mockResolvedValue({code:'OK',recovery:{request:null,retryAt:new Date().toISOString()}});
 render(<CommunicationPanel targetType="CUSTOMER" targetId="TEST-customer"/>);
 await screen.findByText('Der ursprüngliche Mailinhalt fehlt im Versandbeleg. Sende nicht erneut und lass den Versand klären.');expect(screen.getByRole('button',{name:'Neu laden'})).toBeEnabled();
 expect(screen.queryByRole('button',{name:'Versenden'})).not.toBeInTheDocument();
 fireEvent.submit(screen.getByRole('textbox',{name:'Betreff'}).closest('form')!);expect(actions.send).not.toHaveBeenCalled();
});
