import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GlobalCreateFlow,
  type GlobalCreatePorts,
} from "@/components/layout/GlobalCreateFlow";

vi.mock("@/app/actions/domainAttachments.actions", () => ({
  analyzeDomainAttachmentAction: vi.fn(),
  finalizeDomainAttachmentAction: vi.fn(),
  reserveDomainAttachmentAction: vi.fn(),
}));
vi.mock("@/app/actions/communications.actions", () => ({
  attachOutlookMailAction: vi.fn(),
  getMicrosoftGraphStatusAction: vi.fn(),
  listOutlookInboxAction: vi.fn(),
}));
vi.mock("@/app/actions/orders.actions", () => ({ getOrdersDb: vi.fn() }));

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
    canCreateCustomer: true,
    canCreateQuote: true,
    roleLabel: "Rolf",
    resumeQuoteId: null,
    resumeQuoteConversionId: null,
    listCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [{ id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: "SYNTHETISCH Musterkunde GmbH", city: "Teststadt" }] }),
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
      customer: { id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: input.name },
    })),
    saveCustomerNote: vi.fn().mockResolvedValue({ code: "OK" }),
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
        dueDate: "2026-10-20",
        recordedAt: "2026-09-15T10:10:00.000Z",
      },
    })),
    canUseMail: true,
    readIntakeDraft: vi.fn().mockResolvedValue({ code: "OK", data: null }),
    saveIntakeDraft: vi.fn().mockResolvedValue({ code: "OK", data: { updatedAt: "2026-09-15T10:10:00.000Z" } }),
    discardIntakeDraft: vi.fn().mockResolvedValue({ code: "OK", data: { discarded: true } }),
    attachIntakeAttachment: vi.fn().mockResolvedValue({ code: "OK" }),
    attachIntakeMail: vi.fn().mockResolvedValue({ code: "OK" }),
    rememberQuote: vi.fn(),
    rememberQuoteConversion: vi.fn(),
    openCustomer: vi.fn(),
    openOrder: vi.fn(),
    refresh: vi.fn(),
    switchProfile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function openFlow() {
  fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));
}

async function openIntent(intent: "CUSTOMER" | "QUOTE") {
  await act(async () => {
    window.dispatchEvent(new CustomEvent("path1:global-create-open", { detail: intent }));
  });
}

function fillRequiredCustomerAddress() {
  fireEvent.change(screen.getByLabelText("Ansprechpartner"), { target: { value: "Testperson" } });
  fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "kunde@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "+49 221 123456" } });
  fireEvent.change(screen.getByLabelText("Straße"), { target: { value: "Testweg 1" } });
  fireEvent.change(screen.getByLabelText("PLZ"), { target: { value: "12345" } });
  fireEvent.change(screen.getByLabelText("Ort"), { target: { value: "Teststadt" } });
}

async function fillCustomer() {
  fireEvent.change(screen.getByLabelText("Firmenname"), { target: { value: "SYNTHETISCH Musterkunde GmbH" } });
  fireEvent.change(screen.getByLabelText("Ansprechpartner"), { target: { value: "Testperson" } });
  fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "kunde@example.invalid" } });
  fillRequiredCustomerAddress();
  fireEvent.click(screen.getByRole("button", { name: /Neukunde speichern/ }));
  await screen.findByRole("heading", { name: /SYNTHETISCH Musterkunde GmbH · K-2026-0042/ });
}

async function fillQuote() {
  fireEvent.click(screen.getByRole("button", { name: /KV \/ Angebot anlegen/ }));
  fireEvent.change(await screen.findByLabelText("Teil / Bezeichnung"), { target: { value: "Synthetischer Flansch" } });
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
  it("reaches the first manual customer field in two clicks and completes both receipt readbacks", async () => {
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("CUSTOMER");
    expect(document.body).not.toHaveTextContent(/echten Datenstand zurücklesen|Aus der Datenbank zurücklesen|persistenten KV/i);
    await fillCustomer();
    expect(value.createCustomer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("group", { name: "Kundenanlage – technische Details für Support" })).toHaveTextContent("fc8ccfbb-40cf-4050-b4ef-d2b979d9eef5");

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
    fireEvent.change(confirmedDate, { target: { value: "2026-10-20" } });
    expect(confirmedDate).toHaveAttribute("aria-invalid", "false");
    expect(awardButton).toBeEnabled();
    fireEvent.click(awardButton);
    await screen.findByRole("heading", { name: "Auftrag A-2026-0061 angelegt" });
    expect(value.rememberQuoteConversion).toHaveBeenCalledWith(QUOTE_ID, expect.any(String));
    expect(value.convertQuote).toHaveBeenCalledWith(expect.objectContaining({
      quoteId: QUOTE_ID,
      expectedVersion: 1,
      confirmedAward: true,
      confirmedOrderDueDate: "2026-10-20",
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
    fireEvent.change(screen.getByLabelText("Firmenname"), { target: { value: "SYNTHETISCH Interessent" } });
    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "+49 221 998877" } });
    fireEvent.click(screen.getByRole("button", { name: /Neukunde speichern/ }));

    expect(await screen.findByText(/als unvollständig für einen Auftrag markiert/)).toBeInTheDocument();
    expect(value.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
      name: "SYNTHETISCH Interessent",
      phone: "+49 221 998877",
      contactPerson: null,
      email: null,
      street: "",
      zipCode: "",
    }));
    expect(screen.queryByRole("button", { name: /KV \/ Angebot anlegen/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Stammdaten vervollständigen/ }));
    expect(value.openCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
  });

  it("uses one name field, defaults a new customer to Vorkasse and asks when a legacy payment preference is missing", async () => {
    render(<GlobalCreateFlow ports={ports()} />);

    await openIntent("CUSTOMER");
    expect(screen.getAllByLabelText("Firmenname")).toHaveLength(1);
    expect(screen.getByLabelText("Zahlung")).toHaveValue("vorkasse");

    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    openFlow();
    const customerSelect = await screen.findByRole("combobox", { name: "Kunde" });
    await waitFor(() => expect(customerSelect.querySelector(`option[value="${CUSTOMER_ID}"]`)).not.toBeNull());
    fireEvent.change(customerSelect, { target: { value: CUSTOMER_ID } });
    const paymentMode = screen.getByRole("combobox", { name: "Zahlungsmodus" });
    expect(paymentMode).toHaveValue("");
    expect(screen.getByRole("option", { name: /Rechnung auf Ziel \(nicht freigeschaltet\)/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Versand" }));
    expect(paymentMode).toHaveValue("vorkasse");
    expect(screen.getByRole("option", { name: "Vorkasse" })).toBeInTheDocument();
  });

  it("checks an unclear customer result read-only and restores only a verified receipt", async () => {
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
    fireEvent.change(screen.getByLabelText("Firmenname"), { target: { value: "SYNTHETISCH Bleibt erhalten" } });
    fillRequiredCustomerAddress();
    fireEvent.click(screen.getByRole("button", { name: /Neukunde speichern/ }));
    expect(await screen.findByText("Ausgang ungeklärt", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByLabelText("Firmenname")).toHaveValue("SYNTHETISCH Bleibt erhalten");
    fireEvent.click(screen.getByRole("button", { name: "Status mit gleicher Kennung prüfen" }));
    await screen.findByRole("heading", { name: /SYNTHETISCH Bleibt erhalten · K-2026-0042/ });
    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(readCustomerCreateReceipt).toHaveBeenCalledTimes(1);
    expect(readCustomerCreateReceipt.mock.calls[0][0].clientEventId).toBe(createCustomer.mock.calls[0][0].clientEventId);
  });

  it("keeps an unknown result open and requires a separate confirmed retry", async () => {
    const createCustomer = vi.fn<GlobalCreatePorts["createCustomer"]>().mockRejectedValue(new Error("network"));
    const value = ports({ createCustomer, readCustomerCreateReceipt: vi.fn().mockResolvedValue({ code: "NOT_FOUND", message: "Kein Kundenstand gefunden." }) });
    render(<GlobalCreateFlow ports={value} />);
    await openIntent("CUSTOMER");
    fireEvent.change(screen.getByLabelText("Firmenname"), { target: { value: "SYNTHETISCH offen" } });
    fillRequiredCustomerAddress();
    fireEvent.click(screen.getByRole("button", { name: /Neukunde speichern/ }));
    await screen.findByText("Ausgang ungeklärt", { selector: "strong" });
    fireEvent.click(screen.getByRole("button", { name: "Status mit gleicher Kennung prüfen" }));
    await screen.findByRole("button", { name: "Erneut senden vorbereiten" });
    expect(createCustomer).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Erneut senden vorbereiten" }));
    expect(createCustomer).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Ja, jetzt erneut senden" }));
    await waitFor(() => expect(createCustomer).toHaveBeenCalledTimes(2));
  });

  it("never calls commands for readonly and offers a safe profile switch", async () => {
    const value = ports({ canCreateCustomer: false, canCreateQuote: false, roleLabel: "Phillip" });
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("CUSTOMER");
    expect(screen.getByRole("alert")).toHaveTextContent("Rolf ist für diesen Vorgang zuständig");
    fireEvent.click(screen.getByRole("button", { name: "Zum sicheren Profilwechsel" }));
    await waitFor(() => expect(value.switchProfile).toHaveBeenCalledTimes(1));
    expect(value.createCustomer).not.toHaveBeenCalled();
    expect(value.createQuote).not.toHaveBeenCalled();
    expect(value.convertQuote).not.toHaveBeenCalled();
    expect(value.createDirectIntake).not.toHaveBeenCalled();
  });

  it("uses the same V5 flow for direct intake without loading an old intake panel", async () => {
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("path1:global-create-open", { detail: "DIRECT_INTAKE" }));
    });
    await screen.findByRole("heading", { name: "Neuer Eingang" });
    expect(screen.queryByText("Digitaler Wareneingang")).not.toBeInTheDocument();
    const customerSelect = await screen.findByRole("combobox", { name: "Kunde" });
    expect(customerSelect).toHaveValue("");
    fireEvent.change(customerSelect, { target: { value: "NEW" } });
    const newCustomer = screen.getByLabelText("Name / Firma");
    await waitFor(() => expect(newCustomer).toHaveFocus());
    expect(newCustomer).toHaveValue("");
    fireEvent.change(newCustomer, { target: { value: "SYNTHETISCH Direkteingang GmbH" } });
    fillRequiredCustomerAddress();
    fireEvent.change(screen.getByLabelText("Liefertermin"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("Teil / Bezeichnung"), { target: { value: "Synthetischer Flansch" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Ware, Menge und Zustand/ }));
    fireEvent.click(screen.getByRole("button", { name: "Wareneingang buchen" }));
    await screen.findByRole("heading", { name: "Auftrag A-2026-0061 angelegt" });
    expect(value.createDirectIntake).toHaveBeenCalledWith(expect.objectContaining({ dueDate: "2026-10-20" }));
    expect(value.createDirectIntake).toHaveBeenCalledWith(expect.objectContaining({ customer: expect.objectContaining({ mode: "NEW", name: "SYNTHETISCH Direkteingang GmbH" }) }));
    expect(value.createCustomer).not.toHaveBeenCalled();
    expect(value.readDirectIntakeReceipt).toHaveBeenCalledTimes(1);
    expect(value.refresh).toHaveBeenCalledTimes(1);
  });

  it("books a free-text intake when the catalog is empty and keeps the price open", async () => {
    let finishCatalog!: (value: { code: "OK"; services: [] }) => void;
    const listCatalog = vi.fn(() => new Promise<{ code: "OK"; services: [] }>((resolve) => { finishCatalog = resolve; }));
    const value = ports({ listCatalog });
    render(<GlobalCreateFlow ports={value} />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("path1:global-create-open", { detail: "DIRECT_INTAKE" }));
    });
    await screen.findByRole("heading", { name: "Neuer Eingang" });
    fireEvent.change(screen.getByRole("combobox", { name: "Kunde" }), { target: { value: "NEW" } });
    fireEvent.change(screen.getByLabelText("Name / Firma"), { target: { value: "TEST Freitextkunde GmbH" } });
    await act(async () => finishCatalog({ code: "OK", services: [] }));
    expect(screen.getByRole("combobox", { name: "Kunde" })).toHaveValue("NEW");
    expect(screen.getByLabelText("Name / Firma")).toHaveValue("TEST Freitextkunde GmbH");
    fillRequiredCustomerAddress();
    fireEvent.change(screen.getByLabelText("Liefertermin"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("Teil / Bezeichnung"), { target: { value: "TEST Sonderteil" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Oberfläche" }), { target: { value: "Vernickeln" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Ware, Menge und Zustand/ }));
    fireEvent.click(screen.getByRole("button", { name: "Wareneingang buchen" }));
    await screen.findByRole("heading", { name: "Auftrag A-2026-0061 angelegt" });
    expect(value.createDirectIntake).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ catalogServiceId: null, name: "TEST Sonderteil", surfaceRequested: "Vernickeln", unitPriceCents: null })],
    }));
  });

  it("opens the desktop one-page intake directly from the primary action", async () => {
    render(<GlobalCreateFlow ports={ports()} />);

    openFlow();

    await screen.findByRole("heading", { name: "Neuer Eingang" });
    expect(screen.getByRole("navigation", { name: "Abschnitte" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1Kunde/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("combobox", { name: "Zahlungsmodus" })).toHaveValue("bar");
    expect(screen.queryByRole("heading", { name: "Was möchtest du anlegen?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Offene KVs bearbeiten/ })).not.toBeInTheDocument();
  });

  it("keeps a failed inline-new intake atomic and leaves all inputs visible", async () => {
    const createDirectIntake = vi.fn<GlobalCreatePorts["createDirectIntake"]>().mockResolvedValue({ code: "UNAVAILABLE", message: "Speichern nicht verfügbar." });
    const value = ports({ createDirectIntake });
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    fireEvent.change(await screen.findByRole("combobox", { name: "Kunde" }), { target: { value: "NEW" } });
    fireEvent.change(screen.getByLabelText("Name / Firma"), { target: { value: "SYNTHETISCH Direkteingang Retry GmbH" } });
    fillRequiredCustomerAddress();
    fireEvent.change(screen.getByLabelText("Liefertermin"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("Teil / Bezeichnung"), { target: { value: "Synthetischer Flansch" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Ware, Menge und Zustand/ }));
    fireEvent.click(screen.getByRole("button", { name: "Wareneingang buchen" }));

    await waitFor(() => expect(createDirectIntake).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Speichern nicht verfügbar/)).toBeInTheDocument();
    expect(screen.getByLabelText("Name / Firma")).toHaveValue("SYNTHETISCH Direkteingang Retry GmbH");
    expect(createDirectIntake).toHaveBeenCalledTimes(1);
    expect(value.createCustomer).not.toHaveBeenCalled();
  });

  it("clears an award date when editing a KV", async () => {
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("CUSTOMER");
    await fillCustomer();
    await fillQuote();
    fireEvent.change(screen.getByLabelText("Zugesagter Termin für den Auftrag"), { target: { value: "2026-10-20" } });
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
    await waitFor(() => expect(screen.getByLabelText("Firmenname")).toHaveFocus());
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
    fireEvent.change(screen.getByLabelText("Firmenname"), { target: { value: "SYNTHETISCH Eingabe bleibt" } });
    fillRequiredCustomerAddress();
    fireEvent.click(screen.getByRole("button", { name: /Neukunde speichern/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Kundendaten sind nicht vollständig");
    expect(screen.getByLabelText("Firmenname")).toHaveValue("SYNTHETISCH Eingabe bleibt");
    expect(screen.queryByRole("region", { name: "Kunden-Receipt" })).not.toBeInTheDocument();

    unmount();
    const conflictValue = ports({ convertQuote });
    render(<GlobalCreateFlow ports={conflictValue} />);
    await openIntent("CUSTOMER");
    await fillCustomer();
    await fillQuote();
    fireEvent.change(screen.getByLabelText("Zugesagter Termin für den Auftrag"), { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: /Zuschlag bestätigen/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Der KV wurde zwischenzeitlich geändert");
    expect(screen.getByRole("heading", { name: "KV-2026-0042 gesichert" })).toBeInTheDocument();
    expect(screen.getByLabelText("Zugesagter Termin für den Auftrag")).toHaveValue("2026-10-20");
    expect(screen.getByRole("button", { name: /Zuschlag bestätigen/ })).toBeEnabled();
    expect(screen.queryByRole("region", { name: "F1.1-Auftragsreceipt" })).not.toBeInTheDocument();
    expect(conflictValue.openOrder).not.toHaveBeenCalled();
  });

  it("keeps the award date after an unknown conversion outcome", async () => {
    const convertQuote = vi.fn<GlobalCreatePorts["convertQuote"]>().mockRejectedValue(new Error("network"));
    const value = ports({ convertQuote });
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("CUSTOMER");
    await fillCustomer();
    await fillQuote();
    const confirmedDate = screen.getByLabelText("Zugesagter Termin für den Auftrag");
    fireEvent.change(confirmedDate, { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: /Zuschlag bestätigen/ }));

    expect(await screen.findByText("Ausgang ungeklärt", { selector: "strong" })).toBeInTheDocument();
    expect(confirmedDate).toHaveValue("2026-10-20");
    expect(confirmedDate).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByRole("button", { name: /Zuschlag bestätigen/ })).toBeEnabled();
    expect(convertQuote).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the dialog and closes it with Escape", async () => {
    render(<GlobalCreateFlow ports={ports()} />);
    openFlow();
    const customerSelect = await screen.findByRole("combobox", { name: "Kunde" });
    fireEvent.change(customerSelect, { target: { value: "NEW" } });
    await waitFor(() => expect(screen.getByLabelText("Name / Firma")).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(await screen.findByRole("heading", { name: "Entwurf behalten?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Weiter bearbeiten" }));
    expect(screen.getByRole("heading", { name: "Neuer Eingang" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Entwurf behalten?" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Verwerfen" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

});
