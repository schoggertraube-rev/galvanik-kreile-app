import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GlobalCreateFlow,
  type GlobalCreatePorts,
  type GlobalCreateIntent,
} from "@/components/layout/GlobalCreateFlow";
import {IntakeMessageDialogs,type IntakeCapture} from '@/modules/eingang/public';

const CUSTOMER_ID = "72d8c6c6-397c-4a9c-b464-d2e5595eb42a";
const QUOTE_ID = "1c32e174-8494-46f0-9f5f-1a45f2a60bd1";
const ORDER_ID = "b6b493d0-3e70-4a73-88eb-367106068e62";

type QuoteFixture = Extract<Awaited<ReturnType<GlobalCreatePorts["readQuote"]>>, { code: "OK" }>["quote"];

function quote(status: "draft" | "converted" = "draft", overrides: Partial<QuoteFixture> = {}): QuoteFixture {
  return {
    quoteId: QUOTE_ID,
    quoteNumber: "KV-2026-0042",
    customerId: CUSTOMER_ID,
    customerNumber: "K-2026-0042",
    customerDisplayName: "SYNTHETISCH Musterkunde GmbH",
    status,
    version: status === "draft" ? 1 as const : 2 as const,
    currency: "EUR" as const,
    dueDate: "2026-10-15",
    validUntil: null,
    termStatus: null,
    intakeSource: null,
    note: "SYNTHETISCHER KV",
    totalNetCents: 25_000,
    linkedOrderId: status === "converted" ? ORDER_ID : null,
    actorId: "1b3ef014-582c-445f-9fdc-e399d7aa6ef0",
    actorDisplayName: "Büro Test",
    createdAt: "2026-09-14T10:00:00.000Z",
    updatedAt: "2026-09-14T10:00:00.000Z",
    convertedAt: status === "converted" ? "2026-09-14T10:10:00.000Z" : null,
    positions: [{
      id: "1d646e17-18ea-452c-9565-a3ef0553fbfd",
      position: 1,
      name: "Synthetischer Flansch",
      quantity: 2,
      material: "Stahl",
      surfaceRequested: "Verzinken",
      unitPriceCents: 12_500,
      lineTotalCents: 25_000,
    }],
    ...overrides,
  };
}

function ports(overrides: Partial<GlobalCreatePorts> = {}): GlobalCreatePorts {
  return {
    canCreateCustomer: true,canReadCustomers:true,
    canCreateOrder: true,
    canCreateQuote: true,
    canManageMoney: true,
    roleLabel: "Rolf",
    resumeQuoteId: null,
    resumeQuoteConversionId: null,
    listCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [{ id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: "SYNTHETISCH Musterkunde GmbH", customerType: "business", companyName: "SYNTHETISCH Musterkunde GmbH", contactPerson: "Testperson",firstName:"Test",lastName:"Testperson",houseNumber:"1", email: "kunde@example.invalid", phone: "+49 221 123456", street: "Testweg 1", zipCode: "12345", city: "Teststadt", country: "DE", paymentPreference: "vorkasse" }] }),
    searchIntakeCustomers: vi.fn().mockImplementation(async (query: string) => ({ code: "OK", customers: (query === "SYNTHETISCH" || query === "K-2026-0042") ? [{ id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: "SYNTHETISCH Musterkunde GmbH", customerType: "business", companyName: "SYNTHETISCH Musterkunde GmbH", contactPerson: "Testperson",firstName:"Test",lastName:"Testperson",houseNumber:"1", email: "kunde@example.invalid", phone: "+49 221 123456", street: "Testweg 1", zipCode: "12345", city: "Teststadt", country: "DE", paymentPreference: "vorkasse" }] : [] })),
    recognizeIntakeText: vi.fn().mockResolvedValue({ code: "OK", data: { fields: [], positions: [] } }),
    saveCaptureNote: vi.fn().mockImplementation(async (input) => ({ code: "OK", capture: {
      id: input.itemId, version: 1, text: input.text, customerId: null, orderId: null,
      assignment: "offen", usage: "offen", concerns: [], files: [],
    } })),
    getIntakeSuggestions: vi.fn().mockResolvedValue({ code: "OK", data: { term: null, prices: [] } }),
    listCatalog: vi.fn().mockResolvedValue({ code:"OK", services:[{id:"88888888-8888-4888-8888-888888888888",name:"Synthetischer Flansch",surface:"Verzinken",unit:"Stück",netPriceCents:12500,vatRateBasisPoints:1900,standardLeadTimeWorkingDays:5,active:true}] }),
    createCustomer: vi.fn().mockImplementation(async (input) => ({
      code: "OK",
      replayed: false,
      receipt: {
        receiptId: "7af2e6f0-a3c1-4a6c-8a77-71bd79a8a6a5",
        eventId: "fc8ccfbb-40cf-4050-b4ef-d2b979d9eef5",
        customerId: CUSTOMER_ID,
        customerNumber: "K-2026-0042",
        clientEventId: input.clientEventId,
        correlationId: "69791bd1-4eca-48f2-a1eb-ee981ebc13be",
        actorId: "1b3ef014-582c-445f-9fdc-e399d7aa6ef0",
        recordedAt: "2026-09-14T10:00:00.000Z",
      },
      customer: {
        ...input,
        id: CUSTOMER_ID,
        customerNumber: "K-2026-0042",
        name: input.customerType==="privat"?[input.firstName,input.lastName].filter(Boolean).join(" "):input.companyName,
        customerType: input.customerType,
        companyName: input.companyName,
        contactPerson: input.contactPerson,
        email: input.email,
        phone: input.phone,
        street: input.street,
        zipCode: input.zipCode,
        city: input.city,
        country: input.country,
        paymentPreference: input.paymentPreference,
        vatId: input.vatId,
        handoverPreference: null,
      },
    })),
    readCustomerCreateReceipt: vi.fn().mockResolvedValue({ code: "NOT_FOUND", message: "Kein Kundenstand gefunden." }),
    createQuote: vi.fn().mockImplementation(async (input) => ({
      code: "OK",
      replayed: false,
      quote: quote(),
      receipt: {
        receiptId: "0d487dc1-1abe-4c46-ad0d-4d11be814657",
        eventId: "6809f675-ec31-44dd-b9da-6870ee7a3b13",
        quoteId: QUOTE_ID,
        customerId: CUSTOMER_ID,
        actorId: "1b3ef014-582c-445f-9fdc-e399d7aa6ef0",
        clientEventId: input.clientEventId,
        correlationId: "9c0a2813-c5ba-41dc-afd8-80a343adbf31",
        recordedAt: "2026-09-14T10:05:00.000Z",
        aggregateVersion: 1,
      },
    })),
    updateQuote: vi.fn().mockImplementation(async (input) => ({
      code: "OK",
      replayed: false,
      quote: { ...quote(), version: input.expectedVersion + 1, updatedAt: "2026-09-14T10:06:00.000Z" },
      receipt: {
        receiptId: "0d487dc1-1abe-4c46-ad0d-4d11be814657", eventId: "6809f675-ec31-44dd-b9da-6870ee7a3b13",
        quoteId: QUOTE_ID, actorId: "1b3ef014-582c-445f-9fdc-e399d7aa6ef0", clientEventId: input.clientEventId,
        correlationId: "9c0a2813-c5ba-41dc-afd8-80a343adbf31", recordedAt: "2026-09-14T10:06:00.000Z",
        expectedVersion: input.expectedVersion, aggregateVersion: input.expectedVersion + 1,
      },
    })),
    readQuoteCreateReceipt: vi.fn().mockResolvedValue({ code: "NOT_FOUND", message: "Kein KV-Stand gefunden." }),
    readQuoteUpdateReceipt: vi.fn().mockResolvedValue({ code: "NOT_FOUND", message: "Kein KV-Stand gefunden." }),
    readQuote: vi.fn().mockResolvedValue({ code: "OK", quote: quote() }),
    listOpenQuotes: vi.fn().mockResolvedValue({ code: "OK", quotes: [quote()] }),
    convertQuote: vi.fn().mockImplementation(async (input) => ({
      code: "OK",
      replayed: false,
      quote: quote("converted"),
      quoteReceipt: {
        receiptId: "f3f90dbf-f17c-44fd-b47f-d406d2ce8bd6",
        eventId: "42026a2b-1457-4058-b1bf-20846d7bc654",
        quoteId: QUOTE_ID,
        customerId: CUSTOMER_ID,
        orderId: ORDER_ID,
        orderIntakeEventId: "d07f341c-3047-4cdd-b3de-d56eaa306b13",
        actorId: "1b3ef014-582c-445f-9fdc-e399d7aa6ef0",
        clientEventId: input.clientEventId,
        correlationId: "cb167ddd-2b20-4b2d-ac15-1dff2807adef",
        recordedAt: "2026-09-14T10:10:00.000Z",
        aggregateVersion: 2,
      },
      orderReceipt: {
        receiptId: "d07f341c-3047-4cdd-b3de-d56eaa306b13",
        eventId: "49ef919a-d3a2-45a8-9cb1-bc1e7f31124d",
        orderId: ORDER_ID,
        orderNumber: "A-2026-0061",
        customerId: CUSTOMER_ID,
        clientEventId: input.clientEventId,
        correlationId: "5d2086d0-33a5-44ec-82d0-6fb6a9058e60",
        actorId: "1b3ef014-582c-445f-9fdc-e399d7aa6ef0",
        recordedAt: "2026-09-14T10:10:00.000Z",
      },
    })),
    readQuoteConversionReceipt: vi.fn().mockResolvedValue({ code: "NOT_FOUND", message: "Kein Auftragsstand gefunden." }),
    createDirectIntake: vi.fn().mockImplementation(async (input) => ({
      code: "OK",
      replayed: false,
      receipt: {
        receiptId: "b4ef7f74-f0e0-49e2-bf7f-a675b1070768",
        eventId: "1b3ef014-582c-445f-9fdc-e399d7aa6ef0",
        orderId: ORDER_ID,
        orderNumber: "A-2026-0061",
        customerId: CUSTOMER_ID,
        clientEventId: input.clientEventId,
        correlationId: "9c0a2813-c5ba-41dc-afd8-80a343adbf31",
        actorId: "42026a2b-1457-4058-b1bf-20846d7bc654",
        dueDate: input.dueDate,
        termStatus: input.termStatus,
        intakeSource: input.intakeSource,
        recordedAt: "2026-09-15T10:10:00.000Z",
      },
    })),
    readDirectIntakeReceipt: vi.fn().mockImplementation(async (input) => ({
      code: "OK",
      replayed: true,
      receipt: {
        receiptId: "b4ef7f74-f0e0-49e2-bf7f-a675b1070768",
        eventId: "1b3ef014-582c-445f-9fdc-e399d7aa6ef0",
        orderId: input.orderId,
        orderNumber: "A-2026-0061",
        customerId: CUSTOMER_ID,
        clientEventId: input.clientEventId,
        correlationId: "9c0a2813-c5ba-41dc-afd8-80a343adbf31",
        actorId: "42026a2b-1457-4058-b1bf-20846d7bc654",
        dueDate: "2026-11-20",
        termStatus: "wunsch",
        intakeSource: "persoenlich",
        recordedAt: "2026-09-15T10:10:00.000Z",
      },
    })),
    rememberQuote: vi.fn(),
    rememberQuoteConversion: vi.fn(),
    activeCustomerOverlayId: null,
    openCustomer: vi.fn(),
    openOrder: vi.fn(),
    refresh: vi.fn(),
    switchProfile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function openFlow() {
  fireEvent.click(screen.getByRole("button", { name: "Neu erfassen" }));
  fireEvent.click(screen.getByRole("button", { name: "Auftrag oder KV erfassen" }));
}

async function searchAndSelectIntakeCustomer(query: string, expectedName: RegExp) {
  const search = await screen.findByRole("textbox", { name: "Kunde suchen" });
  fireEvent.change(search, { target: { value: query } });
  fireEvent.click(await screen.findByRole("button", { name: expectedName }));
}

async function fillDirectIntakeForExistingCustomer() {
  await searchAndSelectIntakeCustomer("SYNTHETISCH", /SYNTHETISCH Musterkunde GmbH.*übernehmen/);
  fireEvent.click(within(screen.getByRole("group", { name: "Art" })).getAllByRole("button")[0]);
  const [wish] = within(screen.getByRole("group", { name: "Termin ist" })).getAllByRole("button");
  fireEvent.click(wish);
  fireEvent.change(screen.getByRole("combobox", { name: "Eingangsart" }), { target: { value: "persoenlich" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Ware, Menge und Zustand gemeinsam geprüft" }));
  const [pickup] = within(screen.getByRole("group", { name: "Übergabe" })).getAllByRole("button");
  fireEvent.click(pickup);
  fireEvent.change(screen.getByRole("combobox", { name: "Zahlungsmodus" }), { target: { value: "vorkasse" } });
  fireEvent.change(screen.getByLabelText("Liefertermin"), { target: { value: "2026-11-20" } });
  fireEvent.change(screen.getByLabelText("Teil / Leistung"), { target: { value: "Synthetischer Flansch" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Menge" }), { target: { value: "1" } });
  const unit = screen.getByRole("combobox", { name: "Einheit" });
  expect(unit).toHaveValue("stueck"); // PositionZeile: a selected catalog service copies its unit.
  fireEvent.change(unit, { target: { value: "stueck" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Oberfläche" }), { target: { value: "verzinken" } });
}

async function openIntent(intent: GlobalCreateIntent) {
  await act(async () => {
    window.dispatchEvent(new CustomEvent("path1:global-create-open", { detail: intent }));
  });
}

function fillRequiredCustomerAddress() {
  fireEvent.change(screen.getByLabelText("Vorname"), { target: { value: "Test" } });
  fireEvent.change(screen.getByLabelText("Nachname"), { target: { value: "Testperson" } });
  fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "kunde@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "+49 221 123456" } });
  fireEvent.change(screen.getByLabelText("Straße"), { target: { value: "Testweg" } });
  fireEvent.change(screen.getByLabelText("Nr."), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("PLZ"), { target: { value: "12345" } });
  fireEvent.change(screen.getByLabelText("Ort"), { target: { value: "Teststadt" } });
}

async function fillCustomer() {
  fireEvent.click(screen.getByRole("button", { name: "Firma" }));
  fireEvent.change(screen.getByLabelText("Firmenname"), { target: { value: "SYNTHETISCH Musterkunde GmbH" } });
  fireEvent.change(screen.getByLabelText("Vorname"), { target: { value: "Test" } });
  fireEvent.change(screen.getByLabelText("Nachname"), { target: { value: "Testperson" } });
  fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "kunde@example.invalid" } });
  fillRequiredCustomerAddress();
  fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));
}

async function startQuoteForExistingCustomer() {
  await openIntent("QUOTE");
  fireEvent.click(await screen.findByRole("button", { name: /SYNTHETISCH Musterkunde GmbH/ }));
}

async function fillQuote() {
  fireEvent.change(await screen.findByLabelText("Teil / Leistung"), { target: { value: "Synthetischer Flansch" } });
  fireEvent.change(screen.getByLabelText("Material"), { target: { value: "Stahl" } });
  fireEvent.change(screen.getByLabelText("Gewünschter Termin"), { target: { value: "2026-10-15" } });
  fireEvent.change(screen.getByLabelText("Hinweis zum KV"), { target: { value: "SYNTHETISCHER KV" } });
  fireEvent.click(screen.getByRole("button", { name: /KV sichern/ }));
  await screen.findByRole("heading", { name: "KV-2026-0042 gesichert" });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});
afterEach(() => cleanup());

describe("PATH1 V5 globaler Kunde-KV-Auftrag-Fluss", () => {
  it("P44: selects an actual intake mail through 3.4 and returns to the same capture without losing manual entries",async()=>{
    const value=ports({canReadMails:true});
    const mailId='22fe6577-b527-4dce-aacd-b0546cf30918';
    const capture:IntakeCapture={id:mailId,version:1,text:'SYNTHETISCHER Mail-Text',customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:[],files:[{id:'bcfcb12a-e5c6-40a5-bfa3-7b366b474354',name:'SYNTHETISCHER-Anhang.pdf',mime:'application/pdf',bytes:24,readable:true,status:'fertig'}]};
    const list=vi.fn().mockResolvedValue({code:'OK',mails:[{id:mailId,subject:'SYNTHETISCHER Betreff',senderName:'SYNTHETISCHER Absender',senderAddress:'synthetic@fixture.invalid',receivedAt:'2026-11-03T10:00:00Z',fileCount:1,customerId:null}]}),read=vi.fn().mockResolvedValue({code:'OK',capture});
    render(<><IntakeMessageDialogs ports={{list,read}}/><GlobalCreateFlow ports={value}/></>);
    await openIntent('DIRECT_INTAKE');
    fireEvent.click(await screen.findByRole('button',{name:'Auftrag oder KV erfassen'}));
    const intake=await screen.findByRole('dialog',{name:'Auftrag oder KV erfassen'});
    fireEvent.change(within(intake).getByRole('textbox',{name:'Schnell erfassen'}),{target:{value:'SYNTHETISCH manuell vor Mail-Auswahl'}});
    fireEvent.change(within(intake).getByLabelText('Menge'),{target:{value:'7'}});
    fireEvent.click(within(intake).getByRole('button',{name:'Aus Mail'}));
    const selection=await screen.findByRole('dialog',{name:'Wem gehört das?'});
    fireEvent.click(await within(selection).findByRole('button',{name:/SYNTHETISCHER Betreff/}));
    fireEvent.click(await within(selection).findByRole('button',{name:'Übernehmen'}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Wem gehört das?'})).not.toBeInTheDocument());
    expect(within(intake).getByRole('textbox',{name:'Schnell erfassen'})).toHaveValue('SYNTHETISCH manuell vor Mail-Auswahl');
    expect(within(intake).getByLabelText('Menge')).toHaveValue(7);
    expect(within(intake).getByText(/SYNTHETISCHER-Anhang.pdf/)).toBeInTheDocument();
    expect(read).toHaveBeenCalledWith(mailId);
    expect(value.createDirectIntake).not.toHaveBeenCalled();
  });
  it("uses one two-choice entry for plus and the N, A and K shortcuts", async () => {
    const value = ports();
    const { unmount } = render(<GlobalCreateFlow ports={value} />);

    fireEvent.keyDown(window, { key: "n" });
    const entry = await screen.findByRole("dialog", { name: "Neu erfassen" });
    expect(within(within(entry).getByRole("region", { name: "Ohne Vorlage" })).getAllByRole("button")).toHaveLength(2);
    expect(within(entry).getByRole("button", { name: /Auftrag oder KV erfassen/ })).toHaveAttribute("title", "Taste A");
    expect(within(entry).getByRole("button", { name: /Kunde anlegen/ })).toHaveAttribute("title", "Taste K");
    expect(screen.queryByText("Offene KVs bearbeiten")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "a" });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Kunde suchen" })).toHaveFocus());
    unmount();

    render(<GlobalCreateFlow ports={ports()} />);
    fireEvent.click(screen.getByRole("button", { name: "Neu erfassen" }));
    fireEvent.keyDown(window, { key: "k" });
    await waitFor(() => expect(within(screen.getByRole("group",{name:"Kundentyp"})).getByRole("button",{name:"Firma"})).toHaveFocus());
  });

  it("ignores the N shortcut without the eingang right", () => {
    render(<GlobalCreateFlow ports={ports({ canCreateOrder: false, showPrimaryTrigger: false })} />);
    fireEvent.keyDown(window, { key: "n" });
    expect(screen.queryByRole("dialog", { name: "Neu erfassen" })).not.toBeInTheDocument();
  });

  it("opens the shared capture above the same intake and keeps later mail integration separate", async () => {
    render(<GlobalCreateFlow ports={ports()} />);

    openFlow();
    await screen.findByRole("heading", { name: "Auftrag oder KV erfassen" });

    const capture=screen.getByRole("button",{name:"Aufnehmen"});
    expect(capture).toBeEnabled();
    expect(capture.querySelector("svg")).not.toBeNull();
    fireEvent.click(capture);
    const layer=await screen.findByRole("dialog",{name:"Neu erfassen"});
    expect(within(layer).getByRole("heading")).toHaveTextContent("Zettel lesen · für die Erfassung");
    expect(within(layer).getByRole("button",{name:"Datei"})).toBeEnabled();
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    fireEvent.keyDown(window,{key:"Escape"});
    await waitFor(()=>expect(layer).not.toBeInTheDocument());
    expect(screen.getByRole("dialog",{name:"Auftrag oder KV erfassen"})).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Aus Mail" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Datei lesen" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Entwurf.*wieder aufgenommen/i)).not.toBeInTheDocument();
  });

  it("reaches the first manual customer field in two clicks and completes both receipt readbacks", async () => {
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("CUSTOMER");
    expect(document.body).not.toHaveTextContent(/echten Datenstand zurücklesen|Aus der Datenbank zurücklesen|persistenten KV/i);
    await fillCustomer();
    expect(value.createCustomer).toHaveBeenCalledTimes(1);
    expect(value.openCustomer).toHaveBeenCalledWith(CUSTOMER_ID);

    await startQuoteForExistingCustomer();
    await fillQuote();
    expect(value.createQuote).toHaveBeenCalledWith(expect.objectContaining({
      customerId: CUSTOMER_ID,
      dueDate: "2026-10-15",
      positions: [expect.objectContaining({ quantity: 1, unitPriceCents: 12_500 })],
    }));
    expect(value.rememberQuote).toHaveBeenCalledWith(QUOTE_ID);
    expect(screen.getByText(/250,00\s€ netto/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "KV als PDF" })).toHaveAttribute("href", `/api/documents/${QUOTE_ID}/quote-pdf`);

    const confirmedDate = screen.getByLabelText("Zugesagter Termin für den Auftrag");
    const awardButton = screen.getByRole("button", { name: /Zuschlag bestätigen/ });
    expect(document.activeElement).toBe(confirmedDate);
    expect(confirmedDate).toHaveAttribute("aria-invalid", "true");
    expect(awardButton).toBeDisabled();
    fireEvent.change(confirmedDate, { target: { value: "2026-11-20" } });
    expect(confirmedDate).toHaveAttribute("aria-invalid", "false");
    expect(awardButton).toBeEnabled();
    fireEvent.click(awardButton);
    await screen.findByRole("heading", { name: "Auftrag A-2026-0061 angelegt" });
    expect(value.rememberQuoteConversion).toHaveBeenCalledWith(QUOTE_ID, expect.any(String));
    expect(value.convertQuote).toHaveBeenCalledWith(expect.objectContaining({
      quoteId: QUOTE_ID,
      expectedVersion: 1,
      confirmedAward: true,
      confirmedOrderDueDate: "2026-11-20",
      handoverMode: "pickup",
      paymentMode: "vorkasse",
    }));
    expect(value.rememberQuote).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("group", { name: "Auftrag – technische Details für Support" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Auftragskarte öffnen" }));
    expect(value.openOrder).toHaveBeenCalledWith(ORDER_ID);
  });

  it("saves a prospect with name and phone and blocks the order path until master data is complete", async () => {
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("CUSTOMER");
    fireEvent.click(screen.getByRole("button", { name: "Firma" }));
    fireEvent.change(screen.getByLabelText("Firmenname"), { target: { value: "SYNTHETISCH Interessent" } });
    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "+49 221 998877" } });
    fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));

    await waitFor(() => expect(value.openCustomer).toHaveBeenCalledWith(CUSTOMER_ID));
    expect(value.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
      companyName: "SYNTHETISCH Interessent",
      phone: "+49 221 998877",
      firstName:"",lastName:"",
      email: "",
      street: "",
      zipCode: "",
    }));
    expect(value.createQuote).not.toHaveBeenCalled();
  });

  it("uses one name field and derives the allowed intake payment choices from the shared contract", async () => {
    render(<GlobalCreateFlow ports={ports()} />);

    await openIntent("CUSTOMER");
    expect(screen.queryByLabelText("Firmenname")).not.toBeInTheDocument();
    const customerType = screen.getByRole("group", { name: "Kundentyp" });
    expect(within(customerType).getByRole("button", { name: "Firma" })).toHaveAttribute("aria-pressed", "false");
    expect(within(customerType).getByRole("button", { name: "Privat" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Institution" })).not.toBeInTheDocument();
    fireEvent.click(within(customerType).getByRole("button",{name:"Firma"}));
    expect(screen.getAllByLabelText("Firmenname")).toHaveLength(1);
    expect(screen.getByLabelText("Vorname")).toBeInTheDocument();
    expect(screen.getByLabelText("Nachname")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Land" })).toHaveValue("DE");
    expect(screen.getByLabelText("Zahlungsbedingung")).toHaveValue("vorkasse");
    expect(screen.queryByRole("option", { name: /Rechnung auf Ziel/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    fireEvent.click(screen.getByRole("button",{name:"Verwerfen"}));
    openFlow();
    await searchAndSelectIntakeCustomer("SYNTHETISCH", /SYNTHETISCH Musterkunde GmbH.*übernehmen/);
    const paymentMode = screen.getByRole("combobox", { name: "Zahlungsmodus" });
    expect(paymentMode).toHaveValue("vorkasse");
    expect(paymentMode).toBeDisabled();
    expect(screen.getByText("aus Kundenkarte")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Rechnung auf Ziel/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Versand" }));
    expect(paymentMode).toHaveValue("vorkasse");
    expect(screen.getByText("aus Kundenkarte")).toBeInTheDocument();
    expect(within(paymentMode).getByRole("option", { name: "Vorkasse" })).toBeInTheDocument();
    expect(within(paymentMode).getByRole("option", { name: /Bar oder Karte bei Abholung \(Bar oder Karte nur bei Abholung\.\)/ })).toBeDisabled();
  });

  it("prefills bar pickup from the customer card and still allows an approved manual change", async () => {
    const barCustomer = {
      id: CUSTOMER_ID,
      customerNumber: "K-2026-0012",
      name: "SYNTHETISCH Bar-Kunde",
      customerType: "business" as const,
      companyName: "SYNTHETISCH Bar-Kunde",
      contactPerson: "Testperson",firstName:"Test",lastName:"Testperson",houseNumber:"1",
      email: "bar@example.invalid",
      phone: "+49 221 123456",
      street: "Testweg 1",
      zipCode: "12345",
      city: "Teststadt",
      country: "DE",
      paymentPreference: "bar",
    };
    const searchIntakeCustomers = vi.fn().mockResolvedValue({ code: "OK", customers: [barCustomer] });
    render(<GlobalCreateFlow ports={ports({ searchIntakeCustomers })} />);

    openFlow();
    await searchAndSelectIntakeCustomer("Bar-Kunde", /SYNTHETISCH Bar-Kunde.*übernehmen/);
    const [pickup] = within(screen.getByRole("group", { name: "Übergabe" })).getAllByRole("button");
    fireEvent.click(pickup);

    const paymentMode = screen.getByRole("combobox", { name: "Zahlungsmodus" });
    expect(paymentMode).toHaveValue("abholung");
    expect(screen.getByText("aus Kundenkarte")).toBeInTheDocument();
    expect(within(paymentMode).getByRole("option", { name: /Rechnung auf Ziel/ })).toBeDisabled();
    fireEvent.change(paymentMode, { target: { value: "vorkasse" } });
    expect(paymentMode).toHaveValue("vorkasse");
    expect(screen.queryByText("aus Kundenkarte")).not.toBeInTheDocument();
  });

  it("uses the last order only when no customer-card handover exists and shows its origin", async () => {
    const customer = { id:CUSTOMER_ID,customerNumber:"K-2026-0042",name:"SYNTHETISCH Musterkunde GmbH",customerType:"business" as const,
      companyName:"SYNTHETISCH Musterkunde GmbH",firstName:"Test",lastName:"Testperson",phone:"+49 221 123456",email:"kunde@example.invalid",
      street:"Testweg",houseNumber:"1",zipCode:"12345",city:"Teststadt",country:"DE",paymentPreference:"vorkasse",handoverPreference:null,lastHandoverMode:"shipping" as const };
    render(<GlobalCreateFlow ports={ports({searchIntakeCustomers:vi.fn().mockResolvedValue({code:"OK",customers:[customer]})})}/>);
    openFlow();
    await searchAndSelectIntakeCustomer("SYNTHETISCH",/SYNTHETISCH Musterkunde GmbH.*übernehmen/);
    expect(screen.getByRole("button",{name:"Versand"})).toHaveAttribute("aria-pressed","true");
    expect(screen.getByText("wie zuletzt")).toBeInTheDocument();
    expect(screen.getByRole("combobox",{name:"Zahlungsmodus"})).toHaveValue("vorkasse");
    expect(screen.getByText("aus Kundenkarte")).toBeInTheDocument();
  });

  it("requires an explicit decision for a possible duplicate before creating the customer", async () => {
    const duplicate = { id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: "SYNTHETISCH Vorhanden GmbH", companyName: "SYNTHETISCH Vorhanden GmbH", city: "Teststadt" };
    const value = ports({ searchIntakeCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [duplicate] }) });
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("CUSTOMER");
    fireEvent.click(screen.getByRole("button", { name: "Firma" }));
    fireEvent.change(screen.getByLabelText("Firmenname"), { target: { value: "SYNTHETISCH Neu GmbH" } });
    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "+49 221 998877" } });
    expect(await screen.findByText(/Ähnlicher Kunde vorhanden: SYNTHETISCH Vorhanden GmbH/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));
    expect(value.createCustomer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ist ein anderer Kunde" }));
    fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));
    await waitFor(() => expect(value.createCustomer).toHaveBeenCalledTimes(1));
    expect(value.openCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
  });

  it("searches intake customers on the server and offers the existing customer dialog when nothing matches", async () => {
    const searchIntakeCustomers = vi.fn().mockResolvedValue({ code: "OK", customers: [] });
    render(<GlobalCreateFlow ports={ports({ searchIntakeCustomers })} />);

    openFlow();
    const search = await screen.findByRole("textbox", { name: "Kunde suchen" });
    expect(screen.queryByRole("combobox", { name: "Kunde" })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "SYNTHETISCH Neue Firma" } });
    await waitFor(() => expect(searchIntakeCustomers).toHaveBeenCalledWith("SYNTHETISCH Neue Firma"));
    expect(await screen.findByText("Kein Kunde gefunden.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Neukunde anlegen" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Firmenname")).not.toBeInTheDocument();
  });

  it("keeps customer creation visible while typing, below matches and below the empty result", async () => {
    const matchingCustomer = {
      id: CUSTOMER_ID,
      customerNumber: "K-2026-0043",
      name: "Sabrina Schmidt",firstName:"Sabrina",lastName:"Schmidt",houseNumber:"1",
      customerType: "privat" as const,
      companyName: null,
      contactPerson: null,
      email: "sabrina@example.invalid",
      phone: "+49 221 123456",
      street: "Testweg 1",
      zipCode: "12345",
      city: "Teststadt",
      country: "DE",
      paymentPreference: "vorkasse",
    };
    const searchIntakeCustomers = vi.fn<GlobalCreatePorts["searchIntakeCustomers"]>(async (query) => ({
      code: "OK",
      customers: query === "sabrina schmidt" ? [matchingCustomer] : [],
    }));
    render(<GlobalCreateFlow ports={ports({ searchIntakeCustomers })} />);

    openFlow();
    const search = await screen.findByRole("textbox", { name: "Kunde suchen" });
    expect(screen.getByRole("button", { name: "Neukunde anlegen" })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "sabrina schmidt" } });
    expect(screen.getByRole("button", { name: "Neukunde anlegen" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Sabrina Schmidt.*übernehmen/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Neukunde anlegen" })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "kein treffer" } });
    expect(await screen.findByText("Kein Kunde gefunden.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Neukunde anlegen" })).toBeInTheDocument();
  });

  it("accepts a complete private intake customer without a contact person", async () => {
    const privateCustomer = {
      id: CUSTOMER_ID,
      customerNumber: "K-2026-0013",
      name: "gregor laucht",firstName:"Gregor",lastName:"Laucht",houseNumber:"4",
      customerType: "privat" as const,
      companyName: null,
      contactPerson: null,
      email: "gregor@example.invalid",
      phone: "+49 6104 123456",
      street: "Rembrücker Straße 4",
      zipCode: "63150",
      city: "Heusenstamm",
      country: "DE",
      paymentPreference: "vorkasse",
    };
    render(<GlobalCreateFlow ports={ports({ searchIntakeCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [privateCustomer] }) })} />);

    openFlow();
    await searchAndSelectIntakeCustomer("gregor laucht", /gregor laucht.*übernehmen/);
    expect(screen.queryByText(/Ansprechpartner fehlt/)).not.toBeInTheDocument();
    expect(screen.queryByText(/kein Ansprechpartner/)).not.toBeInTheDocument();
    const [wish] = within(screen.getByRole("group", { name: "Termin ist" })).getAllByRole("button");
    fireEvent.click(wish);
    fireEvent.change(screen.getByRole("combobox", { name: "Eingangsart" }), { target: { value: "persoenlich" } });
    const [pickup] = within(screen.getByRole("group", { name: "Übergabe" })).getAllByRole("button");
    fireEvent.click(pickup);
    fireEvent.change(screen.getByRole("combobox", { name: "Zahlungsmodus" }), { target: { value: "vorkasse" } });
    fireEvent.change(screen.getByLabelText("Liefertermin"), { target: { value: "2026-11-20" } });
    fireEvent.change(screen.getByLabelText("Teil / Leistung"), { target: { value: "Synthetischer Flansch" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Menge" }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Oberfläche" }), { target: { value: "verzinken" } });
    expect(screen.getByRole("button", { name: "Wareneingang buchen" })).toBeEnabled();
  });

  it("blocks a company intake customer without a contact person", async () => {
    const companyCustomer = {
      id: CUSTOMER_ID,
      customerNumber: "K-2026-0044",
      name: "SYNTHETISCH Firma GmbH",
      customerType: "business" as const,
      companyName: "SYNTHETISCH Firma GmbH",
      contactPerson: null,
      email: "firma@example.invalid",
      phone: "+49 221 123456",
      street: "Testweg 1",
      zipCode: "12345",
      city: "Teststadt",
      country: "DE",
      paymentPreference: "vorkasse",
    };
    render(<GlobalCreateFlow ports={ports({ searchIntakeCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [companyCustomer] }) })} />);

    openFlow();
    await searchAndSelectIntakeCustomer("Firma", /SYNTHETISCH Firma GmbH.*übernehmen/);
    expect(screen.getAllByText(/Ansprechpartner fehlt/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Wareneingang buchen" })).toBeEnabled();
  });

  it("blocks an incomplete existing customer and exposes only the missing inline fields", async () => {
    const customer = {
      id: CUSTOMER_ID,
      customerNumber: "K-2026-0042",
      name: "SYNTHETISCH Zielkunde GmbH",
      customerType: "business" as const,
      companyName: "SYNTHETISCH Zielkunde GmbH",
      contactPerson: "Testperson",firstName:"Test",lastName:"Testperson",houseNumber:"1",
      email: "zielkunde@example.invalid",
      phone: "+49 221 123456",
      street: "Testweg 1",
      zipCode: "3013",
      city: "Bern",
      country: "DE",
      paymentPreference: "vorkasse",
      vatId: null,
    };
    const value = ports({
      listCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [customer] }),
      searchIntakeCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [customer] }),
    });
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    await searchAndSelectIntakeCustomer("Zielkunde", /SYNTHETISCH Zielkunde GmbH.*übernehmen/);
    expect(screen.getAllByText(/PLZ prüfen/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Wareneingang buchen" })).toBeEnabled();
    expect(screen.getByLabelText("PLZ")).toHaveValue("3013");
    expect(screen.queryByLabelText("Land")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kundenkarte" }));
    expect(value.openCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
  });

  it("keeps the intake below the customer card, rereads the customer after return, and preserves all input", async () => {
    const incompleteCustomer = {
      id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: "SYNTHETISCH Zielkunde GmbH", customerType: "business" as const,
      companyName: "SYNTHETISCH Zielkunde GmbH", contactPerson: "Testperson",firstName:"Test",lastName:"Testperson",houseNumber:"1", email: "zielkunde@example.invalid", phone: "+49 221 123456",
      street: "Testweg 1", zipCode: "3013", city: "Bern", country: "DE", paymentPreference: "vorkasse", vatId: null,
    };
    const completeCustomer = { ...incompleteCustomer, country: "CH" };
    let currentCustomer = incompleteCustomer;
    const listCustomers = vi.fn<GlobalCreatePorts["listCustomers"]>(async () => ({ code: "OK", customers: [currentCustomer] }));
    const base = ports({
      listCustomers,
      searchIntakeCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [incompleteCustomer] }),
    });
    const { rerender } = render(<GlobalCreateFlow ports={{ ...base, activeCustomerOverlayId: null }} />);

    openFlow();
    await searchAndSelectIntakeCustomer("Zielkunde", /SYNTHETISCH Zielkunde GmbH.*übernehmen/);
    fireEvent.change(screen.getByLabelText("Teil / Leistung"), { target: { value: "SYNTHETISCH Eingabe bleibt" } });
    fireEvent.click(screen.getByRole("button", { name: "Kundenkarte" }));
    expect(base.openCustomer).toHaveBeenCalledWith(CUSTOMER_ID);

    rerender(<GlobalCreateFlow ports={{ ...base, activeCustomerOverlayId: CUSTOMER_ID }} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("heading", { name: "Auftrag oder KV erfassen" })).toBeInTheDocument();
    expect(screen.getByLabelText("Teil / Leistung")).toHaveValue("SYNTHETISCH Eingabe bleibt");

    currentCustomer = completeCustomer;
    rerender(<GlobalCreateFlow ports={{ ...base, activeCustomerOverlayId: null }} />);
    await waitFor(() => expect(listCustomers).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText(/PLZ prüfen/)).not.toBeInTheDocument());
    expect(screen.getByLabelText("Teil / Leistung")).toHaveValue("SYNTHETISCH Eingabe bleibt");
  });

  it("marks a customer-card order entry and keeps that customer selected", async () => {
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent("path1:global-create-open", { detail: {
        intent: "DIRECT_INTAKE",
        prefill: { customerId: CUSTOMER_ID },
      } }));
    });

    expect(await screen.findByText("aus der Kundenkarte")).toBeInTheDocument();
    expect(screen.getAllByText("SYNTHETISCH Musterkunde GmbH").length).toBeGreaterThan(0);
    expect(screen.queryByRole("textbox", { name: "Kunde suchen" })).not.toBeInTheDocument();
  });

  it("uses the open card context without copying positions and preserves the inherited baseline", async () => {
    const customers = await ports().listCustomers();
    if (customers.code !== "OK") throw Error("SYNTHETIC_CUSTOMER_FIXTURE_UNAVAILABLE");
    const value = ports({ activeCustomerOverlayId: CUSTOMER_ID,
      getCreateContext: vi.fn().mockResolvedValue({ code: "OK", context: { customerId: CUSTOMER_ID, label: "A-2099-0001 · SYNTHETISCH Musterkunde GmbH" } }),
      listCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [{ ...customers.customers[0], handoverPreference: "shipping" }] }),
    });
    render(<GlobalCreateFlow ports={value} />);
    fireEvent.click(screen.getByRole("button", { name: "Neu erfassen" }));
    expect(await screen.findByText("für A-2099-0001 · SYNTHETISCH Musterkunde GmbH")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Auftrag oder KV erfassen" }));
    expect(await screen.findByText("aus der Kundenkarte")).toBeInTheDocument();
    expect(screen.getByLabelText("Teil / Leistung")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Zahlungsmodus" })).toHaveValue("vorkasse");
    expect(within(screen.getByRole("group", { name: "Übergabe" })).getByRole("button", { name: "Versand" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(value.createDirectIntake).not.toHaveBeenCalled();
  });

  it("removes the card context before the same empty intake entry", async () => {
    const value = ports({ getCreateContext: vi.fn().mockResolvedValue({ code: "OK", context: { customerId: CUSTOMER_ID, label: "SYNTHETISCH Musterkunde GmbH" } }) });
    render(<GlobalCreateFlow ports={value} />);
    fireEvent.click(screen.getByRole("button", { name: "Neu erfassen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Kontext entfernen" }));
    expect(screen.queryByText("für SYNTHETISCH Musterkunde GmbH")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Auftrag oder KV erfassen" }));
    expect(await screen.findByRole("textbox", { name: "Kunde suchen" })).toHaveFocus();
    expect(value.createCustomer).not.toHaveBeenCalled();
    expect(value.createDirectIntake).not.toHaveBeenCalled();
  });

  it("recovers an unclear create using the same idempotency key and opens only its verified customer", async () => {
    const successfulCreate = ports().createCustomer;
    let attempt = 0;
    const createCustomer = vi.fn<GlobalCreatePorts["createCustomer"]>(async (input) => {
      attempt += 1;
      if (attempt === 1) throw new Error("network interrupted");
      return successfulCreate(input);
    });
    const readCustomerCreateReceipt = vi.fn().mockImplementation(async (input) => successfulCreate(input));
    const value = ports({ createCustomer, readCustomerCreateReceipt });
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("CUSTOMER");
    fireEvent.click(screen.getByRole("button", { name: "Firma" }));
    fireEvent.change(screen.getByLabelText("Firmenname"), { target: { value: "SYNTHETISCH Bleibt erhalten" } });
    fillRequiredCustomerAddress();
    fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));
    expect(await screen.findByText(/Speichern fehlgeschlagen · alle Eingaben sind noch da/)).toBeInTheDocument();
    expect(screen.getByLabelText("Firmenname")).toHaveValue("SYNTHETISCH Bleibt erhalten");
    fireEvent.click(screen.getByRole("button", { name: "Erneut speichern" }));
    await waitFor(() => expect(value.openCustomer).toHaveBeenCalledWith(CUSTOMER_ID));
    expect(createCustomer).toHaveBeenCalledTimes(2);
    expect(readCustomerCreateReceipt).not.toHaveBeenCalled();
    expect(createCustomer.mock.calls[1][0].clientEventId).toBe(createCustomer.mock.calls[0][0].clientEventId);
  });

  it("keeps a failed retry visible and preserves the exact request key and form values", async () => {
    const createCustomer = vi.fn<GlobalCreatePorts["createCustomer"]>().mockRejectedValue(new Error("network"));
    const value = ports({ createCustomer, readCustomerCreateReceipt: vi.fn().mockResolvedValue({ code: "NOT_FOUND", message: "Kein Kundenstand gefunden." }) });
    render(<GlobalCreateFlow ports={value} />);
    await openIntent("CUSTOMER");
    fireEvent.click(screen.getByRole("button", { name: "Firma" }));
    fireEvent.change(screen.getByLabelText("Firmenname"), { target: { value: "SYNTHETISCH offen" } });
    fillRequiredCustomerAddress();
    fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));
    await screen.findByText(/Speichern fehlgeschlagen · alle Eingaben sind noch da/);
    expect(createCustomer).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button",{name:"Erneut speichern"}));
    await waitFor(()=>expect(createCustomer).toHaveBeenCalledTimes(2));
    expect(createCustomer.mock.calls[1][0]).toEqual(createCustomer.mock.calls[0][0]);
    expect(value.openCustomer).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Firmenname")).toHaveValue("SYNTHETISCH offen");
  });

  it("never calls commands for readonly and offers a safe profile switch", async () => {
    const value = ports({ canCreateCustomer: false, canCreateOrder: false, canCreateQuote: false, roleLabel: "Phillip" });
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("CUSTOMER");
    expect(screen.getByRole("alert")).toHaveTextContent("Eine freigegebene Person ist für diesen Vorgang zuständig");
    fireEvent.click(screen.getByRole("button", { name: "Zum sicheren Profilwechsel" }));
    await waitFor(() => expect(value.switchProfile).toHaveBeenCalledTimes(1));
    expect(value.createCustomer).not.toHaveBeenCalled();
    expect(value.createQuote).not.toHaveBeenCalled();
    expect(value.convertQuote).not.toHaveBeenCalled();
    expect(value.createDirectIntake).not.toHaveBeenCalled();
  });

  it("uses the same V5 flow for direct intake without loading an old intake panel", async () => {
    const value = ports({ canCreateOrder: true, canCreateQuote: false });
    render(<GlobalCreateFlow ports={value} />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("path1:global-create-open", { detail: "DIRECT_INTAKE" }));
    });
    await screen.findByRole("heading", { name: "Neu erfassen" });
    fireEvent.click(screen.getByRole("button", { name: "Auftrag oder KV erfassen" }));
    expect(screen.queryByText("Digitaler Wareneingang")).not.toBeInTheDocument();
    await fillDirectIntakeForExistingCustomer();
    fireEvent.click(screen.getByRole("button", { name: "Wareneingang buchen" }));
    await waitFor(() => expect(value.openOrder).toHaveBeenCalledWith(ORDER_ID));
    expect(screen.queryByRole("heading", { name: "Auftrag oder KV erfassen" })).not.toBeInTheDocument();
    expect(screen.getByText("Wareneingang gebucht · A-2026-0061")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auftragskarte öffnen" })).not.toBeInTheDocument();
    expect(value.createDirectIntake).toHaveBeenCalledWith(expect.objectContaining({
      dueDate: "2026-11-20",
      termStatus: "wunsch",
      intakeSource: "persoenlich",
    }));
    expect(value.createDirectIntake).toHaveBeenCalledWith(expect.objectContaining({ customer: { mode: "EXISTING", customerId: CUSTOMER_ID } }));
    expect(value.createDirectIntake).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({
        catalogServiceId: "88888888-8888-4888-8888-888888888888",
        unit: "stueck",
        unitPriceCents: 12_500,
        vatRateBasisPoints: 1900,
      })],
    }));
    expect(value.createCustomer).not.toHaveBeenCalled();
    expect(value.readDirectIntakeReceipt).toHaveBeenCalledTimes(1);
    expect(value.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the main intake action clickable and focuses the first missing checklist row without sending", async () => {
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    await screen.findByRole("heading", { name: "Auftrag oder KV erfassen" });

    const submit = screen.getByRole("button", { name: "Wareneingang buchen" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(await screen.findByText("Noch offen: Kunde")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Kunde suchen" })).toHaveFocus();
    expect(screen.getByRole("complementary", { name: "Prüfliste" })).toHaveTextContent(/\d+ von \d+ Pflichtangaben/);
    expect(value.createDirectIntake).not.toHaveBeenCalled();
    expect(screen.getByRole("complementary", { name: "Prüfliste" })).toHaveTextContent("Kunde");
  });

  it("jumps from booking to the first missing position after a complete customer was selected", async () => {
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    await searchAndSelectIntakeCustomer("SYNTHETISCH", /SYNTHETISCH Musterkunde GmbH.*übernehmen/);
    fireEvent.click(screen.getByRole("button", { name: "Wareneingang buchen" }));

    expect(await screen.findByText("Noch offen: Teil / Leistung")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Teil / Leistung")).toHaveFocus());
    expect(value.createDirectIntake).not.toHaveBeenCalled();
  });

  it("keeps mobile booking clickable in the continuous workbench and jumps to the first open customer field", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width"), media: query, onchange: null,
        addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
      })),
    });
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    const next = await screen.findByRole("button", { name: "Wareneingang buchen" });
    expect(screen.queryByRole("button", { name: "Positionen" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Teile & Leistung/ })).toBeInTheDocument();
    expect(next).toBeEnabled();
    fireEvent.click(next);

    expect(await screen.findByText("Noch offen: Kunde")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Kunde suchen" })).toHaveFocus();
    expect(value.createDirectIntake).not.toHaveBeenCalled();
  });

  it("locks a booking synchronously, shows progress, and ignores a second click", async () => {
    let finishCreate!: (result: Awaited<ReturnType<GlobalCreatePorts["createDirectIntake"]>>) => void;
    const createDirectIntake = vi.fn<GlobalCreatePorts["createDirectIntake"]>(() => new Promise((resolve) => { finishCreate = resolve; }));
    const value = ports({ createDirectIntake });
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    await fillDirectIntakeForExistingCustomer();
    const submit = screen.getByRole("button", { name: "Wareneingang buchen" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(await screen.findByRole("button", { name: "Wird gebucht …" })).toBeDisabled();
    expect(createDirectIntake).toHaveBeenCalledTimes(1);
    await act(async () => finishCreate(await ports().createDirectIntake(createDirectIntake.mock.calls[0][0])));
    await waitFor(() => expect(value.openOrder).toHaveBeenCalledWith(ORDER_ID));
  });

  it("prefills only real intake fields and searches with recognized customer data", async () => {
    const recognizeIntakeText = vi.fn<GlobalCreatePorts["recognizeIntakeText"]>().mockResolvedValue({
      code: "OK",
      data: {
        fields: [
          { field: "zipCode", value: "63150", source: "Text Zeile 1" },
          { field: "city", value: "Heusenstamm", source: "Text Zeile 1" },
          { field: "dueDate", value: "2026-11-12", source: "Text Zeile 2" },
        ],
        positions: [{ name: "Flansch", quantity: "2", unit: "Stück", surfaceRequested: "Verzinken", executionRequested: "matt", source: "Text Abschnitt 1" }],
      },
    });
    render(<GlobalCreateFlow ports={ports({ recognizeIntakeText })} />);
    openFlow();
    await screen.findByRole("heading", { name: "Auftrag oder KV erfassen" });

    fireEvent.change(screen.getByRole("textbox", { name: "Schnell erfassen" }), { target: { value: "gregor laucht rembrücker strasse 4 63150 heusenstamm, 2 Stück Flansch verzinken matt bis 12.11." } });
    fireEvent.click(screen.getByRole("button", { name: "Angaben erkennen" }));

    await waitFor(() => expect(screen.getByLabelText("Liefertermin")).toHaveValue("2026-11-12"));
    expect(screen.queryByLabelText("Firmenname")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Kunde suchen" })).toHaveValue("gregor laucht");
    expect(screen.getByLabelText("Liefertermin")).toHaveValue("2026-11-12");
    expect(screen.getByLabelText("Teil / Leistung")).toHaveValue("Flansch");
    expect(screen.getByText(/Angaben erkannt und vorausgefüllt/)).toBeInTheDocument();
    expect(screen.queryByText(/Name \/ Firma: gregor laucht/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PLZ: 63150/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ort: Heusenstamm/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alles bestätigen" }));
    expect(screen.getByText(/Angaben bestätigt/)).toBeInTheDocument();
    expect(screen.queryByText(/PLZ.*bestätigt/)).not.toBeInTheDocument();
    expect(recognizeIntakeText).toHaveBeenCalledWith(expect.stringContaining("gregor laucht"));
  });

  it("uses a name-only quick capture as the customer search and offers the matching customer", async () => {
    const customer = {
      id: CUSTOMER_ID,
      customerNumber: "K-2026-0011",
      name: "Sabrina Schmidt",firstName:"Sabrina",lastName:"Schmidt",houseNumber:"1",
      customerType: "privat" as const,
      companyName: null,
      contactPerson: null,
      email: "sabrina@example.invalid",
      phone: "+49 221 123456",
      street: "Testweg 1",
      zipCode: "12345",
      city: "Teststadt",
      country: "DE",
      paymentPreference: "vorkasse",
    };
    const recognizeIntakeText = vi.fn<GlobalCreatePorts["recognizeIntakeText"]>().mockResolvedValue({ code: "OK", data: { fields: [], positions: [] } });
    const searchIntakeCustomers = vi.fn<GlobalCreatePorts["searchIntakeCustomers"]>(async (query) => ({
      code: "OK",
      customers: query === "sabrina schmidt" ? [customer] : [],
    }));
    render(<GlobalCreateFlow ports={ports({ recognizeIntakeText, searchIntakeCustomers })} />);
    openFlow();

    fireEvent.change(screen.getByRole("textbox", { name: "Schnell erfassen" }), { target: { value: "sabrina schmidt" } });
    const recognize = screen.getByRole("button", { name: "Angaben erkennen" });
    expect(recognize).toBeEnabled();
    expect(recognize).toHaveClass("kr-btn--primaer");
    fireEvent.click(recognize);

    await waitFor(() => expect(searchIntakeCustomers).toHaveBeenCalledWith("sabrina schmidt"));
    expect(screen.getByRole("textbox", { name: "Kunde suchen" })).toHaveValue("Sabrina Schmidt");
    const suggestion = await screen.findByRole("button", { name: /Sabrina Schmidt.*übernehmen/ });
    fireEvent.click(suggestion);
    expect(screen.getAllByText("Sabrina Schmidt").length).toBeGreaterThan(0);
  });

  it("asks before discarding changed intake data and reopens with a fresh empty intake", async () => {
    render(<GlobalCreateFlow ports={ports()} />);
    openFlow();
    await screen.findByRole("heading", { name: "Auftrag oder KV erfassen" });
    fireEvent.change(screen.getByRole("textbox", { name: "Schnell erfassen" }), { target: { value: "SYNTHETISCH nicht speichern" } });
    fireEvent.change(screen.getByLabelText("Teil / Leistung"), { target: { value: "SYNTHETISCH Flansch" } });

    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(await screen.findByRole("heading", { name: "Änderungen nicht gespeichert" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verwerfen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter bearbeiten" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Entwurf behalten" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", {name:"Als Entwurf ablegen"})).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Verwerfen" }));
    expect(await screen.findByText("Entwurf verworfen")).toBeInTheDocument();
    openFlow();
    await screen.findByRole("heading", { name: "Auftrag oder KV erfassen" });
    expect(screen.getByRole("textbox", { name: "Schnell erfassen" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Kunde suchen" })).toHaveValue("");
    expect(screen.getByLabelText("Teil / Leistung")).toHaveValue("");
  });

  it("closes without a prompt when the edited intake value is restored to its opening value", async () => {
    const value=ports();
    render(<GlobalCreateFlow ports={value}/>);
    openFlow();
    const text=await screen.findByRole("textbox",{name:"Schnell erfassen"});
    fireEvent.change(text,{target:{value:"SYNTHETISCH vorübergehend"}});
    fireEvent.change(text,{target:{value:""}});
    fireEvent.click(screen.getByRole("button",{name:"Abbrechen"}));
    await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Auftrag oder KV erfassen"})).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog",{name:"Änderungen nicht gespeichert"})).not.toBeInTheDocument();
    expect(value.createDirectIntake).not.toHaveBeenCalled();
  });

  it("intercepts the close animation before the dirty-intake prompt and restores the editing focus", async () => {
    const value=ports();
    render(<GlobalCreateFlow ports={value}/>);
    openFlow();
    const dialog=await screen.findByRole("dialog",{name:"Auftrag oder KV erfassen"});
    const part=screen.getByLabelText("Teil / Leistung");
    fireEvent.change(part,{target:{value:"SYNTHETISCH Flansch"}});part.focus();
    fireEvent.click(within(dialog).getByRole("button",{name:"Schließen"}));
    const prompt=await screen.findByRole("dialog",{name:"Änderungen nicht gespeichert"});
    expect(dialog.closest(".kr-ebene")).not.toHaveClass("kr-ebene--zu");
    fireEvent.click(within(prompt).getByRole("button",{name:"Weiter bearbeiten"}));
    await waitFor(()=>expect(part).toHaveFocus());
    expect(part).toHaveValue("SYNTHETISCH Flansch");
    expect(screen.getByRole("dialog",{name:"Auftrag oder KV erfassen"})).toBeInTheDocument();
    expect(value.createDirectIntake).not.toHaveBeenCalled();
  });

  it("keeps a new customer inline, preserves the intake and writes no customer before booking",async()=>{
    const value=ports({searchIntakeCustomers:vi.fn().mockResolvedValue({code:"OK",customers:[]})});render(<GlobalCreateFlow ports={value}/>);
    openFlow();await screen.findByRole("heading",{name:"Auftrag oder KV erfassen"});
    fireEvent.change(screen.getByLabelText("Teil / Leistung"),{target:{value:"SYNTHETISCH Flansch bleibt"}});
    fireEvent.change(screen.getByRole("textbox",{name:"Kunde suchen"}),{target:{value:"06100 909090"}});
    await screen.findByText("Kein Kunde gefunden.");fireEvent.click(screen.getByRole("button",{name:"Neukunde anlegen"}));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByLabelText("Telefon")).toHaveValue("06100 909090");
    fireEvent.click(screen.getByRole("button",{name:"Firma"}));
    fireEvent.change(screen.getByLabelText(/Firmenname/),{target:{value:"SYNTHETISCH Neuer Kunde"}});
    expect(screen.getByLabelText("Teil / Leistung")).toHaveValue("SYNTHETISCH Flansch bleibt");
    expect(value.createCustomer).not.toHaveBeenCalled();expect(value.createDirectIntake).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Zurück zur Suche"}));
    expect(screen.getByRole("textbox",{name:"Kunde suchen"})).toHaveValue("06100 909090");
    expect(screen.getByLabelText("Teil / Leistung")).toHaveValue("SYNTHETISCH Flansch bleibt");
    expect(value.openCustomer).not.toHaveBeenCalled();expect(value.createCustomer).not.toHaveBeenCalled();
  });

  it("books a free-text intake when the catalog is empty and keeps the price open", async () => {
    let finishCatalog!: (value: { code: "OK"; services: [] }) => void;
    const listCatalog = vi.fn(() => new Promise<{ code: "OK"; services: [] }>((resolve) => { finishCatalog = resolve; }));
    const value = ports({ listCatalog });
    render(<GlobalCreateFlow ports={value} />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("path1:global-create-open", { detail: "DIRECT_INTAKE" }));
    });
    await screen.findByRole("heading", { name: "Neu erfassen" });
    fireEvent.click(screen.getByRole("button", { name: "Auftrag oder KV erfassen" }));
    await searchAndSelectIntakeCustomer("SYNTHETISCH", /SYNTHETISCH Musterkunde GmbH.*übernehmen/);
    fireEvent.click(within(screen.getByRole("group", { name: "Art" })).getAllByRole("button")[0]);
    const [wish] = within(screen.getByRole("group", { name: "Termin ist" })).getAllByRole("button");
    fireEvent.click(wish);
    fireEvent.change(screen.getByRole("combobox", { name: "Eingangsart" }), { target: { value: "persoenlich" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Ware, Menge und Zustand gemeinsam geprüft" }));
    const [pickup] = within(screen.getByRole("group", { name: "Übergabe" })).getAllByRole("button");
    fireEvent.click(pickup);
    fireEvent.change(screen.getByRole("combobox", { name: "Zahlungsmodus" }), { target: { value: "vorkasse" } });
    await act(async () => finishCatalog({ code: "OK", services: [] }));
    fireEvent.change(screen.getByLabelText("Liefertermin"), { target: { value: "2026-11-20" } });
    fireEvent.change(screen.getByLabelText("Teil / Leistung"), { target: { value: "TEST Sonderteil" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Menge" }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Einheit" }), { target: { value: "stueck" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Oberfläche" }), { target: { value: "vernickeln" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Ausführung" }), { target: { value: "matt" } });
    fireEvent.change(screen.getByLabelText("Material"), { target: { value: "Stahl 1.4301" } });
    expect(screen.getByRole("complementary", { name: "Prüfliste" })).toHaveTextContent("12 von 12 Pflichtangaben");
    fireEvent.click(screen.getByRole("button", { name: "Wareneingang buchen" }));
    await waitFor(() => expect(value.createDirectIntake).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(value.openOrder).toHaveBeenCalledWith(ORDER_ID));
    expect(screen.getByText("Wareneingang gebucht · A-2026-0061")).toBeInTheDocument();
    expect(value.createDirectIntake).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({
        catalogServiceId: null,
        name: "TEST Sonderteil",
        material: "Stahl 1.4301",
        surfaceRequested: "vernickeln",
        executionRequested: "matt",
        unit: "stueck",
        unitPriceCents: null,
      })],
    }));
  });

  it("opens the desktop one-page intake directly from the primary action", async () => {
    render(<GlobalCreateFlow ports={ports()} />);

    openFlow();

    await screen.findByRole("heading", { name: "Auftrag oder KV erfassen" });
    expect(screen.queryByRole("navigation", { name: "Abschnitte" })).not.toBeInTheDocument();
    for (const title of [/1\s*Kunde/, /2\s*Teile & Leistung/, /3\s*Termin & Übergabe/, /4\s*Belege & Prüfung/]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(within(screen.getByRole("group", { name: "Termin ist" })).getAllByRole("button").every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(screen.getByRole("combobox", { name: "Eingangsart" })).toHaveValue("");
    expect(within(screen.getByRole("group", { name: "Übergabe" })).getAllByRole("button").every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(screen.getByRole("combobox", { name: "Zahlungsmodus" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Zahlungsmodus" })).toBeDisabled();
    expect(within(screen.getByRole("group", { name: "Art" })).getAllByRole("button").every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(screen.queryByRole("heading", { name: "Was möchtest du anlegen?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Offene KVs bearbeiten/ })).not.toBeInTheDocument();
  });

  it("hides payment and quote price controls without the geld area", async () => {
    render(<GlobalCreateFlow ports={ports({ canManageMoney: false })} />);

    openFlow();
    await screen.findByRole("heading", { name: "Auftrag oder KV erfassen" });

    expect(screen.queryByRole("combobox", { name: "Zahlungsmodus" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Art" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Preis netto (€)")).not.toBeInTheDocument();
    expect(screen.queryByText("Preisvorschlag")).not.toBeInTheDocument();
  });

  it("shows the term proposal and applies it only after an explicit click", async () => {
    const getIntakeSuggestions = vi.fn<GlobalCreatePorts["getIntakeSuggestions"]>().mockImplementation(async (input) => ({
      code: "OK",
      data: {
        term: {
          achievableDate: "2026-11-23",offerDate:"2026-11-23",
          wishDate: "2026-11-20",
          rating: "nicht_machbar",
          bufferWorkingDays: -2,
          reasons: [{ kind: "lead", text: "Verzinken: 5 Arbeitstage Durchlauf" }, { kind: "effort", text: "1 Aufwandstage" }],
        },
        prices: [{
          positionKey: input.positions[0].key,
          source: "katalog",
          unit: "Stück",
          unitPriceCents: 12_500,
          lineTotalCents: 12_500,
          caseCount: 1,
          cases: [{ kind: "katalog", customerName: "Leistungskatalog", partName: "Synthetischer Flansch", surface: "Verzinken", quantity: null, invoiceDate: null, unitPriceCents: 12_500 }],
        }],
      },
    }));
    render(<GlobalCreateFlow ports={ports({ getIntakeSuggestions })} />);

    openFlow();
    await screen.findByRole("heading", { name: "Auftrag oder KV erfassen" });
    fireEvent.change(screen.getByLabelText("Liefertermin"), { target: { value: "2026-11-20" } });
    fireEvent.change(screen.getByLabelText("Teil / Leistung"), { target: { value: "Synthetischer Flansch" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Menge" }), { target: { value: "1" } });

    fireEvent.click(screen.getByRole("button",{name:"Abholung"}));
    expect(await screen.findByText(/nicht machbar/)).toBeInTheDocument();
    expect(screen.queryByText("Preisvorschlag")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Liefertermin")).toHaveValue("2026-11-20");

    fireEvent.click(screen.getByRole("button", { name: /23.11.*anbieten/ }));
    expect(screen.getByText(/Gegenvorschlag.*23.11.*Wunsch war.*20.11/)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Gegenvorschlag"})).toHaveAttribute("aria-pressed","true");
  });

  it("prefills only the requested customer and never invents required intake values", async () => {
    const getIntakeSuggestions = vi.fn<GlobalCreatePorts["getIntakeSuggestions"]>().mockImplementation(async (input) => ({
      code: "OK",
      data: {
        term: !input.positions[0]?.surfaceRequested ? null : {
          achievableDate: "2026-11-04",
          wishDate: input.wishDate,
          rating: input.wishDate ? "passt" : null,
          bufferWorkingDays: input.wishDate ? 4 : null,
          reasons: [{ kind: "lead", text: "Verzinken: 5 Arbeitstage Durchlauf" }],
        },
        prices: [],
      },
    }));
    const listCustomers = vi.fn<GlobalCreatePorts["listCustomers"]>().mockResolvedValue({
      code: "OK",
      customers: [{ id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: "SYNTHETISCH Musterkunde GmbH",customerType:"business",companyName:"SYNTHETISCH Musterkunde GmbH", city: "Teststadt", handoverPreference: null }],
    });
    render(<GlobalCreateFlow ports={ports({ getIntakeSuggestions, listCustomers })} />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent("path1:global-create-open", { detail: {
        intent: "DIRECT_INTAKE",
        prefill: { customerId: CUSTOMER_ID, intakeSource: "shipping" },
      } }));
    });

    await screen.findByRole("heading", { name: "Auftrag oder KV erfassen" });
    await waitFor(() => expect(screen.getAllByText("SYNTHETISCH Musterkunde GmbH").length).toBeGreaterThan(0));
    const handover = screen.getByRole("group", { name: "Übergabe" });
    expect(within(handover).getAllByRole("button").every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(screen.getByRole("combobox", { name: "Oberfläche" })).toHaveValue("offen");
    expect(screen.getByLabelText("Liefertermin")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("Teil / Leistung"), { target: { value: "Synthetischer Flansch" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Menge" }), { target: { value: "1" } });
    expect(screen.getByRole("combobox", { name: "Oberfläche" })).toHaveValue("verzinken");
    expect(screen.getByLabelText("Liefertermin")).toHaveValue("");
    expect(screen.queryByText("Terminvorschlag")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Oberfläche" }), { target: { value: "vernickeln" } });
    fireEvent.change(screen.getByLabelText("Teil / Leistung"), { target: { value: "Freitext" } });
    fireEvent.change(screen.getByLabelText("Teil / Leistung"), { target: { value: "Synthetischer Flansch" } });
    expect(screen.getByRole("combobox", { name: "Oberfläche" })).toHaveValue("vernickeln");

    fireEvent.change(screen.getByLabelText("Liefertermin"), { target: { value: "2026-11-20" } });
    await waitFor(() => expect(getIntakeSuggestions).toHaveBeenLastCalledWith(expect.objectContaining({ wishDate: "2026-11-20" })));
    expect(screen.getByLabelText("Liefertermin")).toHaveValue("2026-11-20");
  });

  it("keeps a failed existing-customer intake visible and retries with the same client key", async () => {
    const success = ports().createDirectIntake;
    const createDirectIntake = vi.fn<GlobalCreatePorts["createDirectIntake"]>()
      .mockResolvedValueOnce({ code: "UNAVAILABLE", message: "Speichern nicht verfügbar." })
      .mockImplementation(success);
    const value = ports({ createDirectIntake });
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    await fillDirectIntakeForExistingCustomer();
    fireEvent.click(screen.getByRole("button", { name: "Wareneingang buchen" }));

    await waitFor(() => expect(createDirectIntake).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Speichern fehlgeschlagen · alle Eingaben sind noch da")).toBeInTheDocument();
    expect(screen.getByText(/Speichern nicht verfügbar/)).toBeInTheDocument();
    const firstClientKey = createDirectIntake.mock.calls[0][0].clientEventId;
    expect(screen.getAllByText("SYNTHETISCH Musterkunde GmbH").length).toBeGreaterThan(0);
    expect(createDirectIntake).toHaveBeenCalledTimes(1);
    expect(value.createCustomer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Erneut buchen" }));
    await waitFor(() => expect(createDirectIntake).toHaveBeenCalledTimes(2));
    expect(createDirectIntake.mock.calls[1][0].clientEventId).toBe(firstClientKey);
    await waitFor(() => expect(value.openOrder).toHaveBeenCalledWith(ORDER_ID));
  });

  it("clears an award date when editing a KV", async () => {
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("CUSTOMER");
    await fillCustomer();
    await startQuoteForExistingCustomer();
    await fillQuote();
    fireEvent.change(screen.getByLabelText("Zugesagter Termin für den Auftrag"), { target: { value: "2026-11-20" } });
    expect(screen.getByRole("button", { name: /Zuschlag bestätigen/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "KV bearbeiten" }));
    expect(screen.queryByLabelText("Zugesagter Termin für den Auftrag")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "KV sichern" }));
    await screen.findByRole("heading", { name: "KV-2026-0042 gesichert" });
    expect(screen.getByLabelText("Zugesagter Termin für den Auftrag")).toHaveValue("");
    expect(screen.getByLabelText("Zugesagter Termin für den Auftrag")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /Zuschlag bestätigen/ })).toBeDisabled();

  });

  it("keeps the KV context and offers Rolf the real customer path when the tenant is empty", async () => {
    const value = ports({ listCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [] }) });
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("QUOTE");
    expect(await screen.findByText("Noch kein belegter Kunde")).toBeInTheDocument();
    expect(screen.getByText(/Kundenstamm ist geladen/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kunde anlegen" }));
    await waitFor(() => expect(within(screen.getByRole("group",{name:"Kundentyp"})).getByRole("button",{name:"Firma"})).toHaveFocus());
    expect(value.createQuote).not.toHaveBeenCalled();
  });

  it("keeps the draft visible for validation and conflict responses without false success", async () => {
    const createCustomer = vi.fn<GlobalCreatePorts["createCustomer"]>().mockResolvedValue({
      code: "VALIDATION_ERROR",
      message: "Kundendaten sind nicht vollständig.",
    });
    const convertQuote = vi.fn<GlobalCreatePorts["convertQuote"]>().mockResolvedValue({
      code: "CONFLICT",
      message: "Der KV wurde zwischenzeitlich geändert.",
    });
    const validationValue = ports({ createCustomer });
    const { unmount } = render(<GlobalCreateFlow ports={validationValue} />);

    await openIntent("CUSTOMER");
    fireEvent.click(screen.getByRole("button", { name: "Firma" }));
    fireEvent.change(screen.getByLabelText("Firmenname"), { target: { value: "SYNTHETISCH Eingabe bleibt" } });
    fillRequiredCustomerAddress();
    fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));
    expect(await screen.findByText(/Kundendaten sind nicht vollständig/)).toBeInTheDocument();
    expect(screen.getByLabelText("Firmenname")).toHaveValue("SYNTHETISCH Eingabe bleibt");
    expect(screen.queryByRole("region", { name: "Kunden-Receipt" })).not.toBeInTheDocument();

    unmount();
    const conflictValue = ports({ convertQuote });
    render(<GlobalCreateFlow ports={conflictValue} />);
    await startQuoteForExistingCustomer();
    await fillQuote();
    fireEvent.change(screen.getByLabelText("Zugesagter Termin für den Auftrag"), { target: { value: "2026-11-20" } });
    fireEvent.click(screen.getByRole("button", { name: /Zuschlag bestätigen/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Der KV wurde zwischenzeitlich geändert");
    expect(screen.getByRole("heading", { name: "KV-2026-0042 gesichert" })).toBeInTheDocument();
    expect(screen.getByLabelText("Zugesagter Termin für den Auftrag")).toHaveValue("2026-11-20");
    expect(screen.getByRole("button", { name: /Zuschlag bestätigen/ })).toBeEnabled();
    expect(screen.queryByRole("region", { name: "F1.1-Auftragsreceipt" })).not.toBeInTheDocument();
    expect(conflictValue.openOrder).not.toHaveBeenCalled();
  });

  it("keeps the award date after an unknown conversion outcome", async () => {
    const convertQuote = vi.fn<GlobalCreatePorts["convertQuote"]>().mockRejectedValue(new Error("network"));
    const value = ports({ convertQuote });
    render(<GlobalCreateFlow ports={value} />);

    await startQuoteForExistingCustomer();
    await fillQuote();
    const confirmedDate = screen.getByLabelText("Zugesagter Termin für den Auftrag");
    fireEvent.change(confirmedDate, { target: { value: "2026-11-20" } });
    fireEvent.click(screen.getByRole("button", { name: /Zuschlag bestätigen/ }));

    expect(await screen.findByText("Ausgang ungeklärt", { selector: "strong" })).toBeInTheDocument();
    expect(confirmedDate).toHaveValue("2026-11-20");
    expect(confirmedDate).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByRole("button", { name: /Zuschlag bestätigen/ })).toBeEnabled();
    expect(convertQuote).toHaveBeenCalledTimes(1);
  });

  it('PositionZeile retains an entered unit price in both the field and command when part, surface and unit change',async()=>{
    const api=ports();render(<GlobalCreateFlow ports={api}/>);openFlow();await fillDirectIntakeForExistingCustomer();
    fireEvent.change(screen.getByLabelText('Preis netto je Einheit'),{target:{value:'37,40'}});
    fireEvent.change(screen.getByLabelText('Teil / Leistung'),{target:{value:'SYNTHETISCH Anderes Teil'}});
    fireEvent.change(screen.getByRole('combobox',{name:'Oberfläche'}),{target:{value:'verchromen'}});
    fireEvent.change(screen.getByRole('combobox',{name:'Einheit'}),{target:{value:'kg'}});
    fireEvent.change(screen.getByRole('spinbutton',{name:'Menge'}),{target:{value:'1.25'}});
    expect(screen.getByLabelText('Preis netto je Einheit')).toHaveValue('37,40');
    expect(screen.getByText(/46,75.*netto/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Wareneingang buchen'}));
    await waitFor(()=>expect(api.createDirectIntake).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.createDirectIntake).mock.calls[0]?.[0]).toMatchObject({items:[{name:'SYNTHETISCH Anderes Teil',quantity:1.25,unit:'kg',unitPriceCents:3740,vatRateBasisPoints:1900}]});
  });

  it("E40 shows a non-blocking photo warning only when goods are present", () => {
    render(<GlobalCreateFlow ports={ports()} />);
    openFlow();
    const source = screen.getByRole("combobox", { name: "Eingangsart" });
    fireEvent.change(source, { target: { value: "anfrage_telefon" } });
    expect(document.querySelector('[data-spec-id="eingang.pruefliste.eingangsfoto"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-spec-id="eingang.geprueft"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-spec-id="eingang.telefonnotiz"]')).toBeInTheDocument();
    fireEvent.change(source, { target: { value: "persoenlich" } });
    expect(document.querySelector('[data-spec-id="eingang.telefonnotiz"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-spec-id="eingang.pruefliste.eingangsfoto"]')).toHaveTextContent("fehlt · sperrt nicht");
    expect(document.querySelector('[data-spec-id="eingang.pruefliste.geprueft"]')).toHaveTextContent("Ware gemeinsam prüfen");
    expect(document.querySelector('[data-spec-id="eingang.pruefliste.geprueft"]')).toHaveAttribute("data-state", "open");
  });

  it.each([undefined,0])("P67 resumes legacy draft version %s without inventing required values or writing",async(version)=>{
    const draft={id:ORDER_ID,art:"eingang" as const,payload:{art:"eingang",text:"SYNTHETISCH unvollständiger Entwurf",kunde:CUSTOMER_ID,...(version===undefined?{}:{version})},zuletzt_feld:"eingang.erfassen-text",version:0,updated_at:"2026-11-05T12:00:00Z"};
    const drafts={readDrafts:vi.fn().mockResolvedValue({code:"OK",drafts:[draft]}),saveDraft:vi.fn(),discardDraft:vi.fn()};
    const api=ports({drafts});render(<GlobalCreateFlow ports={api}/>);
    await act(async()=>{window.dispatchEvent(new CustomEvent("path1:global-create-open",{detail:{intent:"DIRECT_INTAKE",draftId:ORDER_ID}}));});
    const note=await screen.findByDisplayValue("SYNTHETISCH unvollständiger Entwurf");
    await waitFor(()=>expect(note).toHaveFocus());
    expect(document.querySelector('[data-spec-id="eingang"]')).toHaveTextContent("SYNTHETISCH Musterkunde GmbH");
    expect(document.querySelector('[data-spec-id="eingang.kundenkarte"]')).toBeInTheDocument();
    expect(document.querySelector('[data-spec-id="eingang.menge"]')).toHaveValue(null);
    expect(document.querySelector('[data-spec-id="eingang.liefertermin"]')).toHaveValue("");
    expect(document.querySelector('[data-spec-id="eingang.einheit"]')).toHaveValue("");
    expect(document.querySelector('[data-spec-id="eingang.oberflaeche"]')).toHaveValue("");
    fireEvent.click(screen.getByRole("button",{name:"Wareneingang buchen"}));
    expect(api.createDirectIntake).not.toHaveBeenCalled();
    expect(drafts.saveDraft).not.toHaveBeenCalled();expect(drafts.discardDraft).not.toHaveBeenCalled();
    expect(note).toHaveValue("SYNTHETISCH unvollständiger Entwurf");
  });

  it("P66 retains a stale tab's local input and reports the draft version conflict",async()=>{
    const draft={id:ORDER_ID,art:"eingang" as const,payload:{art:"eingang",text:"SYNTHETISCH gespeicherter Entwurf",kunde:CUSTOMER_ID},zuletzt_feld:"eingang.erfassen-text",version:0,updated_at:"2026-11-05T12:00:00Z"};
    const drafts={
      readDrafts:vi.fn().mockResolvedValue({code:"OK",drafts:[draft]}),
      saveDraft:vi.fn().mockResolvedValue({code:"CONFLICT",message:"Entwurf wurde inzwischen geändert · Eingaben bleiben erhalten."}),
      discardDraft:vi.fn(),
    };
    const api=ports({drafts});render(<GlobalCreateFlow ports={api}/>);
    await act(async()=>{window.dispatchEvent(new CustomEvent("path1:global-create-open",{detail:{intent:"DIRECT_INTAKE",draftId:ORDER_ID}}));});
    const note=await screen.findByDisplayValue("SYNTHETISCH gespeicherter Entwurf");
    fireEvent.change(note,{target:{value:"SYNTHETISCH nur in diesem Tab"}});
    fireEvent.click(screen.getByRole("button",{name:"Abbrechen"}));
    const prompt=await screen.findByRole("dialog",{name:"Änderungen nicht gespeichert"});
    fireEvent.click(within(prompt).getByRole("button",{name:"Als Entwurf ablegen"}));
    await waitFor(()=>expect(drafts.saveDraft).toHaveBeenCalledWith(expect.objectContaining({id:ORDER_ID,expectedVersion:0})));
    expect(note).toHaveValue("SYNTHETISCH nur in diesem Tab");
    expect(await screen.findByText("Entwurf wurde inzwischen geändert · Eingaben bleiben erhalten.")).toBeInTheDocument();
    expect(screen.getByRole("dialog",{name:"Änderungen nicht gespeichert"})).toBeInTheDocument();
  });

  it.each([true, false])("C06/C08 copies canonical order fields without dates, files or a checked goods receipt (geld=%s)", async (canManageMoney) => {
    const api=ports({ canManageMoney, readIntakeOrderSource:vi.fn().mockResolvedValue({code:"OK",source:{
      customerId:CUSTOMER_ID,customerQuery:"SYNTHETISCH",orderNumber:"SYNTHETISCH-A-42",intakeSource:"versand",items:[
        {catalogServiceId:null,name:"SYNTHETISCH Kopie A",quantity:3,material:"Messing",surfaceRequested:"Verchromen",executionRequested:"hochglanz",unit:"Stück",unitPriceCents:canManageMoney?3740:null,vatRateBasisPoints:canManageMoney?1900:null},
        {catalogServiceId:null,name:"SYNTHETISCH Kopie B",quantity:2,material:"Stahl",surfaceRequested:"Verzinken",executionRequested:"gelb_passiviert",unit:"kg",unitPriceCents:null,vatRateBasisPoints:null},
      ],
    }}) });
    render(<GlobalCreateFlow ports={api}/>);
    await act(async()=>{window.dispatchEvent(new CustomEvent("path1:global-create-open",{detail:{intent:"DIRECT_INTAKE",prefill:{orderCopyId:ORDER_ID}}}));});
    expect(await screen.findByDisplayValue("SYNTHETISCH Kopie A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SYNTHETISCH Kopie B")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Messing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Stahl")).toBeInTheDocument();
    expect(document.querySelector('[data-spec-id="eingang.ausfuehrung"]')).toHaveValue("hochglanz");
    expect(document.querySelector('[data-spec-id="eingang.eingangsart"]')).toHaveValue("versand");
    expect(document.querySelector('[data-spec-id="eingang.eingangsart.herkunft"]')).toHaveTextContent("vorgeschlagen · aus SYNTHETISCH-A-42");
    expect(document.querySelector('[data-spec-id="eingang.liefertermin"]')).toHaveValue("");
    expect(document.querySelector('[data-spec-id="eingang.geprueft"]')).not.toBeChecked();
    if(canManageMoney){
      expect(screen.getAllByLabelText("Preis netto je Einheit")[0]).toHaveValue("37,40");
      expect(screen.getAllByLabelText("Preis netto je Einheit")[1]).toHaveValue("");
    }else{
      expect(screen.queryByLabelText("Preis netto je Einheit")).not.toBeInTheDocument();
      expect(document.querySelector('[data-spec-id="eingang.art"]')).not.toBeInTheDocument();
    }
    expect(api.createDirectIntake).not.toHaveBeenCalled();
    expect(api.readIntakeOrderSource).toHaveBeenCalledWith(ORDER_ID);
  });

  it.each([
    ["Bitte nicht zurückrufen, ich melde mich selbst.",[]],
    ["Kein Rückruf mehr nötig.",[]],
    ["Bitte nur die Außenseite verchromen.",["hinweis"]],
    ["Keine Frist, hat Zeit bis Dezember.",[]],
    ["Rufen Sie mich morgen an.",["rueckruf"]],
    ["Preis passt nicht.",["preis_einwand"]],
    ["Sie hatten 180 € gesagt.",["hinweis"]],
    ["Teile fertig? Und bitte die Rechnung an buchhaltung@example.invalid",["nachfrage","kundendaten"]],
    ["Danke, alles gut angekommen.",[]],
  ] as Array<[string,string[]]>)("RT04 renders exactly the shared recognizer's concerns for %s",async(text,ids)=>{
    render(<GlobalCreateFlow ports={ports()}/>);openFlow();
    const field=await screen.findByRole('textbox',{name:'Schnell erfassen'});
    fireEvent.change(field,{target:{value:text}});
    const actual=[...document.querySelectorAll('[data-spec-id^="eingang.anliegen."]')].map(element=>element.getAttribute('data-spec-id')!).filter(id=>!id.endsWith('.abwaehlen'));
    expect(actual).toEqual(ids.map(id=>'eingang.anliegen.'+id));
  });

  it("E33 confirms only the manually edited recognized field",async()=>{
    const api=ports({recognizeIntakeText:vi.fn().mockResolvedValue({code:'OK',data:{fields:[],positions:[{
      name:'SYNTHETISCH Prüfteil',quantity:'3',unit:'kg',surfaceRequested:'Verzinken',executionRequested:'offen',source:'Text',
    }]}})});
    render(<GlobalCreateFlow ports={api}/>);openFlow();
    fireEvent.change(await screen.findByRole('textbox',{name:'Schnell erfassen'}),{target:{value:'3 kg SYNTHETISCH Prüfteil verzinken'}});
    fireEvent.click(screen.getByRole('button',{name:'Angaben erkennen'}));
    await waitFor(()=>expect(document.querySelector('[data-spec-id="eingang.menge.herkunft"]')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('spinbutton',{name:'Menge'}),{target:{value:'4'}});
    expect(document.querySelector('[data-spec-id="eingang.pruefliste.menge"]')).toHaveAttribute('data-state','ok');
    expect(document.querySelector('[data-spec-id="eingang.menge.herkunft"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-spec-id="eingang.pruefliste.oberflaeche"]')).toHaveAttribute('data-state','pending');
  });

  it("weist bei unbestimmter erkannter Menge auf die erforderliche Eingabe hin",async()=>{
    const api=ports({recognizeIntakeText:vi.fn().mockResolvedValue({code:'OK',data:{fields:[],positions:[{
      name:'Teile',quantity:'',unit:'Stück',surfaceRequested:'Verzinken',executionRequested:'offen',source:'Text',
    }]}})});
    render(<GlobalCreateFlow ports={api}/>);openFlow();
    fireEvent.change(await screen.findByRole('textbox',{name:'Schnell erfassen'}),{target:{value:'Ein paar Teile verzinken'}});
    fireEvent.click(screen.getByRole('button',{name:'Angaben erkennen'}));
    await waitFor(()=>expect(document.querySelector('[data-spec-id="eingang.pruefliste.menge"]')).toHaveTextContent('Menge eintragen'));
    expect(document.querySelector('[data-spec-id="eingang.menge.herkunft"]')).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton',{name:'Menge'})).toHaveValue(null);
  });

  it("öffnet bei einer ergänzten erkannten Position das richtige Mengenfeld",async()=>{
    const api=ports({recognizeIntakeText:vi.fn().mockResolvedValue({code:'OK',data:{fields:[],positions:[{
      name:'SYNTHETISCH zweites Teil',quantity:'3',unit:'Stück',surfaceRequested:'Verzinken',executionRequested:'offen',source:'Text',
    }]}})});
    render(<GlobalCreateFlow ports={api}/>);openFlow();
    fireEvent.change(await screen.findByLabelText('Teil / Leistung'),{target:{value:'Synthetischer Flansch'}});
    fireEvent.change(screen.getByRole('spinbutton',{name:'Menge'}),{target:{value:'1'}});
    fireEvent.change(screen.getByRole('textbox',{name:'Schnell erfassen'}),{target:{value:'3 Stück zweites Teil verzinken'}});
    fireEvent.click(screen.getByRole('button',{name:'Angaben erkennen'}));
    await waitFor(()=>expect(screen.getAllByRole('spinbutton',{name:'Menge'})).toHaveLength(2));
    const check=document.querySelector('[data-spec-id="eingang.pruefliste.menge"]');
    expect(check).toHaveTextContent('Menge 3 · erkannt, bestätigen');
    fireEvent.click(check!);
    await waitFor(()=>expect(screen.getAllByRole('spinbutton',{name:'Menge'})[1]).toHaveFocus());
  });

  it("sichert erkannte Positionen über 20 als eigenen Entwurf und behält sie bei einem Fehler",async()=>{
    const positions=Array.from({length:23},(_,index)=>({name:`SYNTHETISCH Teil ${index+1}`,quantity:'1',unit:'Stück' as const,surfaceRequested:'Verzinken',executionRequested:'offen' as const,source:'Text'}));
    const saveDraft=vi.fn().mockResolvedValueOnce({code:'UNAVAILABLE',message:'Speicher nicht erreichbar.'}).mockResolvedValueOnce({code:'OK',drafts:[]})
      .mockImplementationOnce(async input=>({code:'OK',drafts:[{id:input.id,art:'eingang',payload:{...input.payload,source:'abweichend'}}]}))
      .mockImplementationOnce(async input=>({code:'OK',drafts:[{id:input.id,art:'eingang',payload:Object.fromEntries(Object.entries(input.payload).reverse())}]}));
    const drafts={saveDraft,readDrafts:vi.fn().mockResolvedValue({code:'OK',drafts:[]}),discardDraft:vi.fn()};
    const api=ports({drafts,recognizeIntakeText:vi.fn().mockResolvedValue({code:'OK',data:{fields:[],positions}})});
    render(<GlobalCreateFlow ports={api}/>);openFlow();
    fireEvent.change(await screen.findByRole('textbox',{name:'Schnell erfassen'}),{target:{value:'SYNTHETISCH 23 Positionen'}});
    fireEvent.click(screen.getByRole('button',{name:'Angaben erkennen'}));
    const save=await screen.findByRole('button',{name:'Rest als zweiten Beleg anlegen'});
    expect(screen.getByText(/23 Positionen erkannt · 20 übernommen · 3 noch offen/)).toBeInTheDocument();
    fireEvent.click(save);
    await waitFor(()=>expect(saveDraft).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Weiterer Beleg nicht gespeichert/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Rest als zweiten Beleg anlegen'}));
    await waitFor(()=>expect(saveDraft).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Weiterer Beleg nicht bestätigt/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Rest als zweiten Beleg anlegen'}));
    await waitFor(()=>expect(saveDraft).toHaveBeenCalledTimes(3));
    expect(await screen.findByText(/Weiterer Beleg nicht bestätigt/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Rest als zweiten Beleg anlegen'}));
    await waitFor(()=>expect(saveDraft).toHaveBeenCalledTimes(4));
    expect(saveDraft.mock.calls[1][0]).toEqual(saveDraft.mock.calls[0][0]);
    expect(saveDraft.mock.calls[2][0]).toEqual(saveDraft.mock.calls[0][0]);
    expect(saveDraft.mock.calls[3][0]).toEqual(saveDraft.mock.calls[0][0]);
    expect(saveDraft.mock.calls[0][0].payload.items).toHaveLength(3);
    expect(saveDraft.mock.calls[0][0].payload.items[0].name).toBe('SYNTHETISCH Teil 21');
    expect(await screen.findByText(/Weiterer Beleg als Entwurf gespeichert/)).toBeInTheDocument();
  });

  it("E22 visibly adjusts a selected pickup payment to advance payment when handover changes to shipping",async()=>{
    const api=ports();render(<GlobalCreateFlow ports={api}/>);openFlow();await fillDirectIntakeForExistingCustomer();
    fireEvent.change(screen.getByRole('combobox',{name:'Zahlungsmodus'}),{target:{value:'abholung'}});
    fireEvent.click(screen.getByRole('button',{name:'Versand'}));
    expect(screen.getByRole('combobox',{name:'Zahlungsmodus'})).toHaveValue('vorkasse');
    expect(document.querySelector('[data-spec-id="eingang.zahlungsmodus.herkunft"]')).toHaveTextContent('angepasst: Versand');
    expect(api.createCustomer).not.toHaveBeenCalled();expect(api.createDirectIntake).not.toHaveBeenCalled();
  });

  it("E25 focuses a missing customer payment preference and derives the mode only after an explicit choice",async()=>{
    const api=ports(),listed=await api.listCustomers();if(listed.code!=='OK')throw Error('CUSTOMER_FIXTURE_REQUIRED');
    api.searchIntakeCustomers=vi.fn().mockResolvedValue({code:'OK',customers:listed.customers.map(customer=>({...customer,paymentPreference:''}))});
    render(<GlobalCreateFlow ports={api}/>);openFlow();
    fireEvent.change(await screen.findByRole('textbox',{name:'Kunde suchen'}),{target:{value:'SYNTHETISCH'}});
    fireEvent.click(await screen.findByRole('button',{name:/SYNTHETISCH Musterkunde GmbH/}));
    fireEvent.click(screen.getByRole('button',{name:'Abholung'}));
    expect(screen.getByRole('combobox',{name:'Zahlungsmodus'})).toHaveValue('');
    fireEvent.click(screen.getByRole('button',{name:'Jetzt ergänzen'}));
    const field=document.querySelector('[data-spec-id="eingang.zahlungsbedingung"]');
    await waitFor(()=>expect(field).toHaveFocus());
    expect(document.querySelector('[data-spec-id="eingang.pruefliste.kunde"]')).toHaveTextContent('Zahlungsbedingung wählen');
    fireEvent.change(field!,{target:{value:'bar'}});
    expect(screen.getByRole('combobox',{name:'Zahlungsmodus'})).toHaveValue('abholung');
    expect(api.createCustomer).not.toHaveBeenCalled();expect(api.createDirectIntake).not.toHaveBeenCalled();
  });

  it("moves focus into the dialog and closes the non-persistent intake with Escape", async () => {
    render(<GlobalCreateFlow ports={ports()} />);
    openFlow();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Kunde suchen" })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

});
