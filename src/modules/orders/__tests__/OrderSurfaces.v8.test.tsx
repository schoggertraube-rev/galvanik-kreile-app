import { fireEvent, render, screen, waitFor,within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderCardView, type OrderCardActionPorts, type OrderCardModel } from "../public";

const actions: OrderCardActionPorts = {
  dueDate: { visible: true, enabled: true, reason: null },
  handoff: { visible: false, enabled: false, reason: null },
  evidence: { visible: false, enabled: false, reason: null },
  freeze: { visible: false, enabled: false, reason: null },
  invoice: { visible: false, enabled: false, reason: null },
  payment: { visible: false, enabled: false, reason: null },
  goodsOut: { visible: false, enabled: false, reason: null },
  label: { visible: false, enabled: false, reason: null },
  feedback: { kind: "idle", message: "" },
  onChangeDueDate: vi.fn(),
  onHandoff: vi.fn(),
  onFreeze: vi.fn(),
  onIssueInvoice: vi.fn(),
  onConfirmPayment: vi.fn(),
  onRecordGoodsOut: vi.fn(),
  onPrintLabel: vi.fn(),
  onReload: vi.fn(),
};

const card: OrderCardModel = {
  id: "order-1",
  version: 1,
  orderNumber: "A-2026-0042",
  customerId: "customer-1",
  customerName: "Muster GmbH",
  title: "Geländer Süd",
  note: "Bitte separat verpacken",
  station: "angenommen",
  status: "angenommen",
  dueAt: "2026-09-20",
  intakeAt: "2026-09-16T08:00:00.000Z",
  assignedTo: null,
  dueDateChanges: [{ eventId: "event-1", changedTo: "2026-09-20", reason: "Kundenwunsch", changedAt: "2026-09-17T09:00:00.000Z", changedBy: "Rolf Kreile", aggregateVersion: 2 }],
  labelPrints: [],
  items: [{ id: "item-1", position: 1, name: "Haltewinkel", quantity: 2, material: "Stahl", surface: "Blau verzinken", extraWork: [] }],
  evidence: [],
  frozenAt: null,
  totalAmountCents: null,
  payment: { kind: "available", value: { mode: "vorkasse", invoiceState: "not_issued", status: null, openAmountCents: null, goodsOutAllowed: false, paymentEvent: null, goodsOut: null } },
  catalog: [{ id: "11111111-1111-4111-8111-111111111111", name: "Vernickeln", surface: "Nickel", unit: "Stück", netPriceCents: 1200, vatRateBasisPoints: 1900 }],
};

describe("Orders V1.1 one-surface truth", () => {
  it('AF19 shows the stored handover and real callback/original in the card and outgoing check',()=>{
    const dispatch=vi.fn((event:Event)=>event.preventDefault());
    window.addEventListener('kreile:oeffne',dispatch);
    try{
      render(<OrderCardView actions={{...actions,goodsOut:{visible:true,enabled:true,reason:null}}} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{kind:'data',card:{...card,station:'fertig',handoverMode:'shipping',shippingService:'TEST Versanddienst',handoverNotice:{message:'TEST Bitte ruf den Kunden an.',taskId:'TEST-task',taskState:'offen',originalItemId:'TEST-mail'}}}}/>);
      const panel=document.querySelector('[data-spec-id="auftrag.uebergabe"]')!;
      expect(panel).toHaveTextContent('TEST Versanddienst');
      expect(panel).toHaveTextContent('TEST Bitte ruf den Kunden an.');
      fireEvent.click(within(panel as HTMLElement).getByRole('button',{name:/Original/i}));
      expect(dispatch.mock.calls.at(-1)?.[0]).toMatchObject({detail:{ziel:'mailein',arg:'TEST-mail'}});
      fireEvent.click(within(panel as HTMLElement).getByRole('button',{name:/Aufgabe/i}));
      expect(dispatch.mock.calls.at(-1)?.[0]).toMatchObject({detail:{ziel:'aufgabe',arg:'TEST-task'}});
      fireEvent.click(screen.getAllByRole('button',{name:'Ware raus'}).at(-1)!);
      const outgoing=document.querySelector('[data-spec-id="rauspruefen"]')!;
      expect(outgoing).toHaveTextContent('TEST Versanddienst');
      expect(outgoing).toHaveTextContent('TEST Bitte ruf den Kunden an.');
    }finally{window.removeEventListener('kreile:oeffne',dispatch);}
  });
  it('R53 opens exactly one existing photo panel and protects an unfinished upload from closing',async()=>{
    vi.stubGlobal('matchMedia',()=>({matches:true}));
    try {
    const onClose=vi.fn();
    const panel=(busy:boolean)=><section aria-label="TEST Upload" data-domain-uploading={busy?'true':undefined}><input type="file" aria-label="TEST Foto"/></section>;
    const view=render(<OrderCardView state={{kind:'data',card}} actions={actions} photoPanel={panel(true)} initialPhotosOpen onOpenCustomer={vi.fn()} onClose={onClose}/>);
    const dialog=screen.getByRole('dialog',{name:'Fotos & Dokumente'});
    expect(screen.getAllByLabelText('TEST Foto')).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button',{name:'Schließen'}));
    expect(screen.getByRole('dialog',{name:'Fotos & Dokumente'})).toBeInTheDocument();
    view.rerender(<OrderCardView state={{kind:'data',card}} actions={actions} photoPanel={panel(false)} initialPhotosOpen onOpenCustomer={vi.fn()} onClose={onClose}/>);
    fireEvent.click(within(dialog).getByRole('button',{name:'Schließen'}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Fotos & Dokumente'})).not.toBeInTheDocument());
    expect(screen.getAllByLabelText('TEST Foto')).toHaveLength(1);expect(onClose).not.toHaveBeenCalled();
    }finally{vi.unstubAllGlobals();}
  });
  it("shows each stored unit and makes a missing unit visible", () => {
    const items = [
      { ...card.items[0], id: "synthetic-kg", name: "SYNTHETISCH Gewicht", quantity: 2.5, unit: "kg" },
      { ...card.items[0], id: "synthetic-missing", position: 2, name: "SYNTHETISCH ohne Einheit", unit: null },
    ];
    render(<OrderCardView actions={actions} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{ kind: "data", card: { ...card, items } }} />);
    expect(screen.getByText(/2\.5 kg/)).toBeInTheDocument();
    expect(screen.getByText(/Einheit fehlt/)).toBeInTheDocument();
    expect(screen.queryByText(/2\.5 Stück/)).not.toBeInTheDocument();
  });
  it("renders the complete V1.1 card and customer cross-link", () => {
    const openCustomer = vi.fn();
    render(<OrderCardView actions={actions} onClose={vi.fn()} onOpenCustomer={openCustomer} state={{ kind: "data", card }} />);
    expect(document.querySelector('[data-spec-id="auftrag"]')).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Auftragskarte A-2026-0042" })).toHaveTextContent("A-2026-0042");
    expect(screen.getByText("Teile")).toBeInTheDocument();
    expect(screen.getAllByText("angenommen").length).toBeGreaterThan(0);
    expect(screen.getByText("Galvanik")).toBeInTheDocument();
    expect(screen.getByText(/Vorkasse · Rechnung noch nicht ausgestellt/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Muster GmbH/ }));
    expect(openCustomer).toHaveBeenCalledWith("customer-1");
  });

  it("keeps implementation details out of the visible empty card copy", () => {
    render(<OrderCardView actions={actions} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{ kind: "data", card: { ...card, items: [], evidence: [] } }} />);
    expect(screen.getByText("Für diesen Auftrag sind noch keine Positionen erfasst.")).toBeInTheDocument();
    expect(screen.getByText("Noch keine Dokumente oder Fotos vorhanden.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Auftragskarte A-2026-0042" })).not.toHaveTextContent(/Readback|kanonisch|tenantgebunden/i);
  });

  it("translates legacy evidence codes into workshop language", () => {
    render(<OrderCardView actions={actions} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{
      kind: "data",
      card: {
        ...card,
        evidence: [{
          key: "legacy-scan-upload:c1a-legacy-scan",
          source: "LEGACY_SCAN_UPLOAD",
          state: "LEGACY_RECORDED",
          recordedAt: "2026-10-29T16:00:00.000Z",
          itemIds: [],
        }],
      },
    }} />);
    const orderCard = screen.getByRole("dialog", { name: "Auftragskarte A-2026-0042" });
    expect(orderCard).toHaveTextContent("Übernommener Scan · Original erfasst");
    expect(orderCard).not.toHaveTextContent("LEGACY_SCAN_UPLOAD");
    expect(orderCard).not.toHaveTextContent("LEGACY_RECORDED");
  });

  it("requires a reason and exposes the persisted due-date history", () => {
    const onChangeDueDate = vi.fn();
    render(<OrderCardView actions={{ ...actions, onChangeDueDate }} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{ kind: "data", card }} />);
    expect(screen.getByText(/Kundenwunsch/)).toHaveTextContent("Rolf Kreile");
    fireEvent.click(screen.getByRole("button", { name: "Termin ändern" }));
    const reason = screen.getByLabelText("Grund der Änderung");
    expect(reason).toBeRequired();
    expect(reason).toHaveAttribute("minLength", "3");
    fireEvent.change(screen.getByLabelText("Neuer Liefertermin"), { target: { value: "2026-09-24" } });
    fireEvent.change(reason, { target: { value: "Material verspätet" } });
    fireEvent.submit(screen.getByRole("button", { name: "Termin mit Grund speichern" }).closest("form")!);
    expect(onChangeDueDate).toHaveBeenCalledWith("2026-09-24", "Material verspätet");
  });

  it("offers the persisted label reprint through the correct device action and history", () => {
    const onPrintLabel = vi.fn();
    render(<OrderCardView actions={{
      ...actions,
      label: { visible: true, enabled: true, reason: null },
      onPrintLabel,
    }} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{
      kind: "data",
      card: {
        ...card,
        labelPrints: [{ eventId: "label-event-1", occurredAt: "2026-09-18T09:30:00.000Z" }],
      },
    }} />);

    fireEvent.click(screen.getByRole("button", { name: "Laufzettel drucken" }));
    expect(onPrintLabel).toHaveBeenCalledOnce();
    expect(screen.getByText("Laufzettel gedruckt")).toBeInTheDocument();
  });

  it("requires an explicit payment method before confirming money received", async () => {
    const onConfirmPayment = vi.fn().mockResolvedValue(true);
    render(<OrderCardView actions={{ ...actions, payment: { visible: true, enabled: true, reason: null }, onConfirmPayment }} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{ kind: "data", card }} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Zahlung" })[0]);
    expect(screen.getByRole("dialog", { name: "Zahlung bestätigen" })).toBeInTheDocument();
    expect(onConfirmPayment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Bar" }));
    fireEvent.click(screen.getByRole("button", { name: "Zahlung bestätigen" }));
    await waitFor(() => expect(onConfirmPayment).toHaveBeenCalledWith("bar"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Zahlung bestätigen" })).not.toBeInTheDocument());
  });

  it("keeps a failed payment in the dialog and shows an event-backed payment in history", async () => {
    const onConfirmPayment = vi.fn().mockResolvedValue(false);
    const paidCard: OrderCardModel = {
      ...card,
      payment: {
        kind: "available",
        value: {
          mode: "vorkasse",
          invoiceState: "issued",
          invoiceId: "invoice-1",
          invoiceNumber: "R-2026-0042",
          status: "bezahlt",
          openAmountCents: 0,
          goodsOutAllowed: true,
          paymentEvent: {
            eventId: "payment-event-1",
            actorId: "actor-1",
            occurredAt: "2026-09-18T09:30:00.000Z",
            method: "bar",
          },
          goodsOut: null,
        },
      },
    };
    render(<OrderCardView actions={{ ...actions, payment: { visible: true, enabled: true, reason: null }, feedback: { kind: "error", message: "Zahlung konnte nicht bestätigt werden." }, onConfirmPayment }} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{ kind: "data", card: paidCard }} />);
    expect(screen.getByText("Zahlung bestätigt · Bar")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Zahlung" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Zahlung bestätigen" });
    expect(dialog).toHaveTextContent("Zahlung konnte nicht bestätigt werden.");
    fireEvent.click(screen.getByRole("button", { name: "Bar" }));
    fireEvent.click(screen.getByRole("button", { name: "Zahlung bestätigen" }));
    await waitFor(() => expect(onConfirmPayment).toHaveBeenCalledWith("bar"));
    expect(screen.getByRole("dialog", { name: "Zahlung bestätigen" })).toBeInTheDocument();
  });

  it("keeps a shipment bookable when payment and the existing goods-out contract allow it", async () => {
    const onRecordGoodsOut = vi.fn().mockResolvedValue(false);
    const shippingCard: OrderCardModel = {
      ...card,
      station: "fertig",
      handoverMode: "shipping",
      payment: {
        kind: "available",
        value: {
          mode: "vorkasse",
          invoiceState: "issued",
          status: "bezahlt",
          openAmountCents: 0,
          goodsOutAllowed: true,
          paymentEvent: null,
          goodsOut: null,
        },
      },
    };

    render(<OrderCardView actions={{
      ...actions,
      goodsOut: { visible: true, enabled: true, reason: null },
      onRecordGoodsOut,
    }} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{ kind: "data", card: shippingCard }} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Ware raus" }).at(-1)!);
    const ship = screen.getByRole("button", { name: "Versendet" });
    expect(ship).toBeEnabled();
    expect(screen.queryByText("Sendungsnummer fehlt")).toBeNull();
    fireEvent.click(ship);
    await waitFor(() => expect(onRecordGoodsOut).toHaveBeenCalledWith("versand", undefined));
  });

  it("shows the confirmed invoice receipt where the invoice was issued", () => {
    render(<OrderCardView actions={{
      ...actions,
      feedback: {
        kind: "success",
        message: "Rechnung R-2026-0042 wurde unveränderlich ausgestellt.",
        receipt: {
          kind: "invoice",
          actorId: "actor-1",
          occurredAt: "2026-09-18T09:30:00.000Z",
          eventId: "invoice-event-1",
          receiptId: "invoice://invoice-1/3",
        },
      },
    }} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{ kind: "data", card }} />);

    const confirmation = screen.getByRole("dialog", { name: "Rechnung ausgestellt" });
    expect(confirmation).toHaveTextContent("Rechnung R-2026-0042 wurde unveränderlich ausgestellt.");
    expect(confirmation).toHaveTextContent("Die Rechnung ist gespeichert und in der Auftragskarte nachgelesen.");
  });

  it("exposes the V1.1 action rail and persists note, item and part-state changes through ports", async () => {
    const onSaveContent = vi.fn();
    const onToggleItemFinished = vi.fn();
    const onOpenStatusMail = vi.fn();
    const onCallCustomer = vi.fn();
    const onOpenPhoto = vi.fn();
    render(<OrderCardView actions={{
      ...actions,
      content: { visible: true, enabled: true, reason: null },
      itemStatus: { visible: true, enabled: true, reason: null },
      contact: { visible: true, enabled: true, reason: null },
      photo: { visible: true, enabled: true, reason: null },
      onSaveContent, onToggleItemFinished, onOpenStatusMail, onCallCustomer, onOpenPhoto,
    }} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{ kind: "data", card: { ...card, customerPhone: "+49 711 123" } }} />);

    fireEvent.click(screen.getByRole("button", { name: "Status-Mail" }));
    fireEvent.click(screen.getByRole("button", { name: "Anrufen" }));
    fireEvent.click(screen.getByRole("button", { name: "Foto +" }));
    expect(onOpenStatusMail).toHaveBeenCalledOnce();
    expect(onCallCustomer).toHaveBeenCalledOnce();
    expect(onOpenPhoto).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Teil bearbeiten" }));
    fireEvent.change(screen.getByLabelText("Menge"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Teil speichern" }));
    expect(onSaveContent).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ id: "item-1", quantity: 3 })] }));

    fireEvent.click(screen.getByRole("button", { name: "Notiz" }));
    fireEvent.change(screen.getByLabelText("Notiz"), { target: { value: "Neue Auftragsnotiz" } });
    fireEvent.click(screen.getByRole("button", { name: "Notiz speichern" }));
    expect(onSaveContent).toHaveBeenLastCalledWith(expect.objectContaining({ note: "Neue Auftragsnotiz" }));

    fireEvent.click(screen.getByRole("button", { name: "fertig" }));
    expect(onToggleItemFinished).toHaveBeenCalledWith("item-1", true);
  });

  it("adds a free-text part with its own surface when no catalog service is selected", () => {
    const onSaveContent = vi.fn();
    render(<OrderCardView actions={{
      ...actions,
      content: { visible: true, enabled: true, reason: null },
      onSaveContent,
    }} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{ kind: "data", card: { ...card, catalog: [] } }} />);

    fireEvent.click(screen.getByRole("button", { name: "Teil hinzufügen" }));
    fireEvent.change(screen.getByLabelText("Teil / Bezeichnung"), { target: { value: "TEST Sonderteil" } });
    fireEvent.change(screen.getByLabelText("Oberfläche"), { target: { value: "Vernickeln" } });
    const buttons = screen.getAllByRole("button", { name: "Teil hinzufügen" });
    fireEvent.click(buttons[buttons.length - 1]!);

    expect(onSaveContent).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([expect.objectContaining({
        catalogServiceId: null,
        name: "TEST Sonderteil",
        surface: "Vernickeln",
        unitPriceCents: null,
      })]),
    }));
  });

  it.each(["denied", "error", "conflict"] as const)("keeps %s fail-closed", (kind) => {
    render(<OrderCardView actions={actions} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{ kind, message: "Sicherer Zustand" }} />);
    expect(screen.getByRole(kind === "denied" ? "status" : "alert")).toHaveTextContent("Sicherer Zustand");
    expect(screen.queryByRole("dialog", { name: /Auftragskarte A-/ })).not.toBeInTheDocument();
  });
});

it('opens complaint recording from the existing More menu for an eligible delivered order',async()=>{
 vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 try{
  const record=vi.fn();
  render(<OrderCardView state={{kind:'data',card:{...card,station:'abgeholt',status:'abgeholt'}}} actions={{...actions,onRecordComplaint:record}} onOpenCustomer={vi.fn()} onClose={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Mehr'}));
  fireEvent.click(await screen.findByRole('button',{name:'Reklamation'}));
  expect(record).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog',{name:'Mehr'})).not.toBeInTheDocument();
 }finally{vi.unstubAllGlobals();}
});

it('AK renders creator, latest actor and canonical assignee and keeps take errors next to the button',()=>{
 const take=vi.fn(async()=>{}),evidence={eventId:'TEST-event',userId:'TEST-a',name:'TEST Ada',at:'2026-11-08T12:00:00Z',action:'ORDER_INTAKE_CREATED_V1',mailSender:null};
 const actorCard={...card,actors:{currentLoginId:'TEST-b',createdBy:evidence,lastActor:{...evidence,userId:'TEST-b',name:'TEST Bea',action:'ORDER_TASK_ASSIGNED_V1'},responsible:{userId:'TEST-a',name:'TEST Ada',at:evidence.at,source:'assignment' as const},assignmentUnavailable:false}};
 render(<OrderCardView state={{kind:'data',card:actorCard}} actions={{...actions,takeResponsibility:{visible:true,enabled:true,reason:null},onTakeResponsibility:take,feedback:{kind:'error',message:'TEST Zuordnung noch nicht gespeichert',operation:'responsibility'}}} onClose={vi.fn()} onOpenCustomer={vi.fn()}/>);
 const panel=document.querySelector('[data-spec-id="auftrag.akteure"]') as HTMLElement;
 expect(panel).toHaveTextContent('Angelegt von TEST Ada');expect(panel).toHaveTextContent('Zuletzt: TEST Bea');expect(panel).toHaveTextContent('Zuständig: TEST Ada');expect(within(panel).getByRole('alert')).toHaveTextContent('TEST Zuordnung noch nicht gespeichert');
 expect(screen.getAllByText('TEST Zuordnung noch nicht gespeichert')).toHaveLength(1);
 fireEvent.click(within(panel).getByRole('button',{name:'Übernehmen'}));expect(take).toHaveBeenCalledTimes(1);
});

it('SA correction keeps the creator distinct from responsibility and offers taking an unassigned order to the creator',()=>{
 const take=vi.fn(async()=>{}),evidence={eventId:'TEST-created',userId:'TEST-a',name:'TEST Ada',at:'2026-11-08T12:00:00Z',action:'ORDER_INTAKE_CREATED_V1',mailSender:null};
 render(<OrderCardView state={{kind:'data',card:{...card,actors:{currentLoginId:'TEST-a',createdBy:evidence,lastActor:evidence,responsible:null,assignmentUnavailable:false}}}} actions={{...actions,takeResponsibility:{visible:true,enabled:true,reason:null},onTakeResponsibility:take}} onClose={vi.fn()} onOpenCustomer={vi.fn()}/>);const panel=document.querySelector('[data-spec-id="auftrag.akteure"]') as HTMLElement;expect(panel).toHaveTextContent('Angelegt von TEST Ada');expect(panel).toHaveTextContent('Noch niemand zuständig');fireEvent.click(within(panel).getByRole('button',{name:'Übernehmen'}));expect(take).toHaveBeenCalledOnce();
});

it('SA correction maps an unavailable assignment code through the catalog without rendering a server diagnostic',()=>{
 render(<OrderCardView state={{kind:'data',card:{...card,actors:{currentLoginId:'TEST-a',createdBy:null,lastActor:null,responsible:null,assignmentUnavailable:true,assignmentReadError:'UNAVAILABLE'}}}} actions={actions} onClose={vi.fn()} onOpenCustomer={vi.fn()}/>);
 expect(screen.getByText('Zuständigkeit gerade nicht lesbar - lade den Auftrag neu.')).toBeInTheDocument();expect(screen.queryByText('Noch niemand zuständig')).not.toBeInTheDocument();expect(screen.queryByText('UNAVAILABLE')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Neu laden'}));expect(actions.onReload).toHaveBeenCalled();
});

it('SA review gives a validation rejection a reload exit beside the responsibility action',()=>{
 const reload=vi.fn();render(<OrderCardView state={{kind:'data',card:{...card,actors:{currentLoginId:'TEST-a',createdBy:null,lastActor:null,responsible:null,assignmentUnavailable:false}}}} actions={{...actions,onReload:reload,feedback:{kind:'error',operation:'responsibility',code:'VALIDATION_ERROR',message:'Der Auftrag hat sich inzwischen geändert. Lade ihn neu und übernimm ihn dann.'}}} onClose={vi.fn()} onOpenCustomer={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Neu laden'}));expect(reload).toHaveBeenCalledOnce();
});
