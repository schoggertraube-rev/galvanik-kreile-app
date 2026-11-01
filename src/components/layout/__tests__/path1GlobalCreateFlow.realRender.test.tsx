import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GlobalCreateFlow,
  type GlobalCreatePorts,
} from "@/components/layout/GlobalCreateFlow";

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
    canCreateCustomer: true,
    canCreateOrder: true,
    canCreateQuote: true,
    canManageMoney: true,
    roleLabel: "Rolf",
    resumeQuoteId: null,
    resumeQuoteConversionId: null,
    listCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [{ id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: "SYNTHETISCH Musterkunde GmbH", customerType: "business", companyName: "SYNTHETISCH Musterkunde GmbH", contactPerson: "Testperson", email: "kunde@example.invalid", phone: "+49 221 123456", street: "Testweg 1", zipCode: "12345", city: "Teststadt", country: "Deutschland", paymentPreference: "vorkasse" }] }),
    searchIntakeCustomers: vi.fn().mockImplementation(async (query: string) => ({ code: "OK", customers: query === "SYNTHETISCH" ? [{ id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: "SYNTHETISCH Musterkunde GmbH", customerType: "business", companyName: "SYNTHETISCH Musterkunde GmbH", contactPerson: "Testperson", email: "kunde@example.invalid", phone: "+49 221 123456", street: "Testweg 1", zipCode: "12345", city: "Teststadt", country: "Deutschland", paymentPreference: "vorkasse" }] : [] })),
    recognizeIntakeText: vi.fn().mockResolvedValue({ code: "OK", data: { fields: [], positions: [] } }),
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
      customer: { id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: input.name },
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
        dueDate: "2026-10-20",
        termStatus: "wunsch",
        intakeSource: "persoenlich",
        recordedAt: "2026-09-15T10:10:00.000Z",
      },
    })),
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
  fireEvent.click(screen.getByRole("button", { name: "Neu erfassen" }));
}

async function searchAndSelectIntakeCustomer(query: string, expectedName: RegExp) {
  const search = await screen.findByRole("textbox", { name: "Kunde suchen" });
  fireEvent.change(search, { target: { value: query } });
  fireEvent.click(await screen.findByRole("button", { name: expectedName }));
}

async function fillDirectIntakeForExistingCustomer() {
  await searchAndSelectIntakeCustomer("SYNTHETISCH", /SYNTHETISCH Musterkunde GmbH.*Auswählen/);
  const [pickup] = within(screen.getByRole("group", { name: "Übergabe" })).getAllByRole("button");
  fireEvent.click(pickup);
  fireEvent.change(screen.getByRole("combobox", { name: "Zahlungsmodus" }), { target: { value: "vorkasse" } });
  fireEvent.change(screen.getByLabelText("Liefertermin"), { target: { value: "2026-10-20" } });
  fireEvent.change(screen.getByLabelText("Teil / Bezeichnung"), { target: { value: "Synthetischer Flansch" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Menge" }), { target: { value: "1" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Oberfläche" }), { target: { value: "Verzinken" } });
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
  fireEvent.click(screen.getByRole("button", { name: "Gewerbe" }));
  fireEvent.change(screen.getByLabelText("Name / Firma"), { target: { value: "SYNTHETISCH Musterkunde GmbH" } });
  fireEvent.change(screen.getByLabelText("Ansprechpartner"), { target: { value: "Testperson" } });
  fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "kunde@example.invalid" } });
  fillRequiredCustomerAddress();
  fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));
}

async function startQuoteForExistingCustomer() {
  await openIntent("QUOTE");
  fireEvent.click(await screen.findByRole("button", { name: /SYNTHETISCH Musterkunde GmbH/ }));
}

async function fillQuote() {
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
  it("keeps later intake channels and draft restoration outside AP-01", async () => {
    render(<GlobalCreateFlow ports={ports()} />);

    openFlow();
    await screen.findByRole("heading", { name: "Neu erfassen" });

    expect(screen.getByLabelText("Fotos mit Tablet/Handy")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("Fotos mit Tablet/Handy").querySelector("svg.lucide-camera")).not.toBeNull();

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
    fireEvent.click(screen.getByRole("button", { name: "Gewerbe" }));
    fireEvent.change(screen.getByLabelText("Name / Firma"), { target: { value: "SYNTHETISCH Interessent" } });
    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "+49 221 998877" } });
    fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));

    await waitFor(() => expect(value.openCustomer).toHaveBeenCalledWith(CUSTOMER_ID));
    expect(value.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
      name: "SYNTHETISCH Interessent",
      phone: "+49 221 998877",
      contactPerson: null,
      email: null,
      street: "",
      zipCode: "",
    }));
    expect(value.createQuote).not.toHaveBeenCalled();
  });

  it("uses one name field and requires explicit intake handover and payment choices", async () => {
    render(<GlobalCreateFlow ports={ports()} />);

    await openIntent("CUSTOMER");
    expect(screen.getAllByLabelText("Name / Firma")).toHaveLength(1);
    const customerType = screen.getByRole("group", { name: "Kundentyp" });
    expect(within(customerType).getByRole("button", { name: "Gewerbe" })).toHaveAttribute("aria-pressed", "false");
    expect(within(customerType).getByRole("button", { name: "Privat" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Institution" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Land" })).toHaveValue("Deutschland");
    expect(screen.getByLabelText("Zahlungsbedingung")).toHaveValue("vorkasse");
    expect(screen.queryByRole("option", { name: /Rechnung auf Ziel/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    openFlow();
    await searchAndSelectIntakeCustomer("SYNTHETISCH", /SYNTHETISCH Musterkunde GmbH.*Auswählen/);
    const paymentMode = screen.getByRole("combobox", { name: "Zahlungsmodus" });
    expect(paymentMode).toHaveValue("");
    expect(screen.getByRole("option", { name: /Rechnung auf Ziel \(nicht freigeschaltet\)/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Versand" }));
    expect(paymentMode).toHaveValue("");
    expect(within(paymentMode).getByRole("option", { name: "Vorkasse" })).toBeInTheDocument();
    expect(within(paymentMode).getByRole("option", { name: /Bar oder Karte bei Abholung \(nur bei Abholung\)/ })).toBeDisabled();
  });

  it("requires an explicit decision for a possible duplicate before creating the customer", async () => {
    const duplicate = { id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: "SYNTHETISCH Vorhanden GmbH", companyName: "SYNTHETISCH Vorhanden GmbH", city: "Teststadt" };
    const value = ports({ searchIntakeCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [duplicate] }) });
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("CUSTOMER");
    fireEvent.click(screen.getByRole("button", { name: "Gewerbe" }));
    fireEvent.change(screen.getByLabelText("Name / Firma"), { target: { value: "SYNTHETISCH Neu GmbH" } });
    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "+49 221 998877" } });
    expect(await screen.findByText(/Ähnlicher Kunde vorhanden: SYNTHETISCH Vorhanden GmbH/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));
    expect(value.createCustomer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Trotzdem neu anlegen" }));
    fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));
    await waitFor(() => expect(value.createCustomer).toHaveBeenCalledTimes(1));
    expect(value.openCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
  });

  it("searches intake customers on the server without opening a second customer creation path", async () => {
    const searchIntakeCustomers = vi.fn().mockResolvedValue({ code: "OK", customers: [] });
    render(<GlobalCreateFlow ports={ports({ searchIntakeCustomers })} />);

    openFlow();
    const search = await screen.findByRole("textbox", { name: "Kunde suchen" });
    expect(screen.queryByRole("combobox", { name: "Kunde" })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "SYNTHETISCH Neue Firma" } });
    await waitFor(() => expect(searchIntakeCustomers).toHaveBeenCalledWith("SYNTHETISCH Neue Firma"));
    expect(await screen.findByText("Kein Kunde gefunden.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /als Neukunde anlegen/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Name / Firma")).not.toBeInTheDocument();
  });

  it("blocks an incomplete existing customer and opens only the customer card for correction", async () => {
    const customer = {
      id: CUSTOMER_ID,
      customerNumber: "K-2026-0042",
      name: "SYNTHETISCH Zielkunde GmbH",
      customerType: "business" as const,
      companyName: "SYNTHETISCH Zielkunde GmbH",
      contactPerson: "Testperson",
      email: "zielkunde@example.invalid",
      phone: "+49 221 123456",
      street: "Testweg 1",
      zipCode: "3013",
      city: "Bern",
      country: "Deutschland",
      paymentPreference: "vorkasse",
      vatId: null,
    };
    const value = ports({
      listCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [customer] }),
      searchIntakeCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [customer] }),
    });
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    await searchAndSelectIntakeCustomer("Zielkunde", /SYNTHETISCH Zielkunde GmbH.*Auswählen/);
    expect(screen.getAllByText(/PLZ 3013 passt nicht zu Deutschland/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Wareneingang buchen" })).toBeDisabled();
    expect(screen.queryByLabelText("PLZ")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Land")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "In Kundenkarte ergänzen" }));
    expect(value.openCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
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
    fireEvent.click(screen.getByRole("button", { name: "Gewerbe" }));
    fireEvent.change(screen.getByLabelText("Name / Firma"), { target: { value: "SYNTHETISCH Bleibt erhalten" } });
    fillRequiredCustomerAddress();
    fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));
    expect(await screen.findByText("Ausgang ungeklärt", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name / Firma")).toHaveValue("SYNTHETISCH Bleibt erhalten");
    fireEvent.click(screen.getByRole("button", { name: "Status mit gleicher Kennung prüfen" }));
    await waitFor(() => expect(value.openCustomer).toHaveBeenCalledWith(CUSTOMER_ID));
    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(readCustomerCreateReceipt).toHaveBeenCalledTimes(1);
    expect(readCustomerCreateReceipt.mock.calls[0][0].clientEventId).toBe(createCustomer.mock.calls[0][0].clientEventId);
  });

  it("keeps an unknown result open and requires a separate confirmed retry", async () => {
    const createCustomer = vi.fn<GlobalCreatePorts["createCustomer"]>().mockRejectedValue(new Error("network"));
    const value = ports({ createCustomer, readCustomerCreateReceipt: vi.fn().mockResolvedValue({ code: "NOT_FOUND", message: "Kein Kundenstand gefunden." }) });
    render(<GlobalCreateFlow ports={value} />);
    await openIntent("CUSTOMER");
    fireEvent.click(screen.getByRole("button", { name: "Gewerbe" }));
    fireEvent.change(screen.getByLabelText("Name / Firma"), { target: { value: "SYNTHETISCH offen" } });
    fillRequiredCustomerAddress();
    fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));
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
    expect(screen.queryByText("Digitaler Wareneingang")).not.toBeInTheDocument();
    await fillDirectIntakeForExistingCustomer();
    fireEvent.click(screen.getByRole("button", { name: "Wareneingang buchen" }));
    await screen.findByRole("heading", { name: "Auftrag A-2026-0061 angelegt" });
    expect(value.createDirectIntake).toHaveBeenCalledWith(expect.objectContaining({
      dueDate: "2026-10-20",
      termStatus: "wunsch",
      intakeSource: "persoenlich",
    }));
    expect(value.createDirectIntake).toHaveBeenCalledWith(expect.objectContaining({ customer: { mode: "EXISTING", customerId: CUSTOMER_ID } }));
    expect(value.createCustomer).not.toHaveBeenCalled();
    expect(value.readDirectIntakeReceipt).toHaveBeenCalledTimes(1);
    expect(value.refresh).toHaveBeenCalledTimes(1);
  });

  it("locks the main intake action while mandatory intake data is missing", async () => {
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    await screen.findByRole("heading", { name: "Neu erfassen" });

    const submit = screen.getByRole("button", { name: "Wareneingang buchen" });
    expect(submit).toBeDisabled();
    expect(screen.getByRole("complementary", { name: "Prüfliste" })).toHaveTextContent(/\d+ von \d+ Pflichtangaben/);
    expect(value.createDirectIntake).not.toHaveBeenCalled();
    expect(screen.getByRole("complementary", { name: "Prüfliste" })).toHaveTextContent("Kunde");
  });

  it("prefills recognized intake text and confirms every marked value together", async () => {
    const recognizeIntakeText = vi.fn<GlobalCreatePorts["recognizeIntakeText"]>().mockResolvedValue({
      code: "OK",
      data: {
        fields: [
          { field: "companyName", value: "TEST Erkannt GmbH", source: "Text Zeile 1" },
          { field: "dueDate", value: "2026-11-12", source: "Text Zeile 2" },
        ],
        positions: [{ name: "Flansch", quantity: "2", unit: "Stück", surfaceRequested: "Verzinken", executionRequested: "matt", source: "Text Abschnitt 1" }],
      },
    });
    render(<GlobalCreateFlow ports={ports({ recognizeIntakeText })} />);
    openFlow();
    await screen.findByRole("heading", { name: "Neu erfassen" });

    fireEvent.change(screen.getByRole("textbox", { name: "Schnell erfassen" }), { target: { value: "TEST Erkannt GmbH, 2 Stück Flansch verzinken matt bis 12.11." } });
    fireEvent.click(screen.getByRole("button", { name: "Angaben erkennen" }));

    await waitFor(() => expect(screen.getByLabelText("Liefertermin")).toHaveValue("2026-11-12"));
    expect(screen.queryByLabelText("Name / Firma")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Kunde suchen" })).toHaveValue("");
    expect(screen.getByLabelText("Liefertermin")).toHaveValue("2026-11-12");
    expect(screen.getByLabelText("Teil / Bezeichnung")).toHaveValue("Flansch");
    expect(screen.getByText(/Angaben erkannt und vorausgefüllt/)).toBeInTheDocument();
    expect(screen.getByText(/Name \/ Firma: TEST Erkannt GmbH · erkannt/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alles bestätigen" }));
    expect(screen.getByText(/Angaben bestätigt/)).toBeInTheDocument();
    expect(recognizeIntakeText).toHaveBeenCalledWith(expect.stringContaining("TEST Erkannt GmbH"));
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
    await searchAndSelectIntakeCustomer("SYNTHETISCH", /SYNTHETISCH Musterkunde GmbH.*Auswählen/);
    const [pickup] = within(screen.getByRole("group", { name: "Übergabe" })).getAllByRole("button");
    fireEvent.click(pickup);
    fireEvent.change(screen.getByRole("combobox", { name: "Zahlungsmodus" }), { target: { value: "vorkasse" } });
    await act(async () => finishCatalog({ code: "OK", services: [] }));
    fireEvent.change(screen.getByLabelText("Liefertermin"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("Teil / Bezeichnung"), { target: { value: "TEST Sonderteil" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Menge" }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Oberfläche" }), { target: { value: "Vernickeln" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Ausführung" }), { target: { value: "matt" } });
    fireEvent.change(screen.getByLabelText("Material"), { target: { value: "Stahl 1.4301" } });
    expect(screen.getByRole("complementary", { name: "Prüfliste" })).toHaveTextContent("7 von 7 Pflichtangaben");
    fireEvent.click(screen.getByRole("button", { name: "Wareneingang buchen" }));
    await waitFor(() => expect(value.createDirectIntake).toHaveBeenCalledTimes(1));
    await screen.findByRole("heading", { name: "Auftrag A-2026-0061 angelegt" });
    expect(value.createDirectIntake).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({
        catalogServiceId: null,
        name: "TEST Sonderteil",
        material: "Stahl 1.4301",
        surfaceRequested: "Vernickeln",
        executionRequested: "matt",
        unitPriceCents: null,
      })],
    }));
  });

  it("opens the desktop one-page intake directly from the primary action", async () => {
    render(<GlobalCreateFlow ports={ports()} />);

    openFlow();

    await screen.findByRole("heading", { name: "Neu erfassen" });
    expect(screen.getByRole("navigation", { name: "Abschnitte" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1Kunde/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("combobox", { name: "Zahlungsmodus" })).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "Was möchtest du anlegen?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Offene KVs bearbeiten/ })).not.toBeInTheDocument();
  });

  it("hides payment and quote price controls without the geld area", async () => {
    render(<GlobalCreateFlow ports={ports({ canManageMoney: false })} />);

    openFlow();
    await screen.findByRole("heading", { name: "Neu erfassen" });

    expect(screen.queryByRole("combobox", { name: "Zahlungsmodus" })).not.toBeInTheDocument();
    expect(screen.getByText("Anliegen")).toBeInTheDocument();
    expect(screen.getAllByText("Auftrag").length).toBeGreaterThan(0);
    expect(screen.queryByRole("group", { name: "Art" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Preis netto (€)")).not.toBeInTheDocument();
    expect(screen.queryByText("Preisvorschlag")).not.toBeInTheDocument();
  });

  it("shows the term proposal and applies it only after an explicit click", async () => {
    const getIntakeSuggestions = vi.fn<GlobalCreatePorts["getIntakeSuggestions"]>().mockImplementation(async (input) => ({
      code: "OK",
      data: {
        term: {
          achievableDate: "2026-11-03",
          wishDate: "2026-10-30",
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
    await screen.findByRole("heading", { name: "Neu erfassen" });
    fireEvent.change(screen.getByLabelText("Liefertermin"), { target: { value: "2026-10-30" } });
    fireEvent.change(screen.getByLabelText("Teil / Bezeichnung"), { target: { value: "Synthetischer Flansch" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Menge" }), { target: { value: "1" } });

    expect(await screen.findByText("Terminvorschlag")).toBeInTheDocument();
    expect(screen.queryByText("Preisvorschlag")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Liefertermin")).toHaveValue("2026-10-30");

    fireEvent.click(screen.getByRole("button", { name: "2026-11-03 übernehmen" }));
    expect(screen.getByLabelText("Liefertermin")).toHaveValue("2026-11-03");
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
      customers: [{ id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: "SYNTHETISCH Musterkunde GmbH", city: "Teststadt", lastHandoverMode: "shipping" }],
    });
    render(<GlobalCreateFlow ports={ports({ getIntakeSuggestions, listCustomers })} />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent("path1:global-create-open", { detail: {
        intent: "DIRECT_INTAKE",
        prefill: { customerId: CUSTOMER_ID, intakeSource: "shipping" },
      } }));
    });

    await screen.findByRole("heading", { name: "Neu erfassen" });
    await waitFor(() => expect(screen.getAllByText("SYNTHETISCH Musterkunde GmbH").length).toBeGreaterThan(0));
    const handover = screen.getByRole("group", { name: "Übergabe" });
    expect(within(handover).getAllByRole("button").every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(screen.getByRole("combobox", { name: "Oberfläche" })).toHaveValue("");
    expect(screen.getByLabelText("Liefertermin")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("Teil / Bezeichnung"), { target: { value: "Synthetischer Flansch" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Menge" }), { target: { value: "1" } });
    expect(screen.getByRole("combobox", { name: "Oberfläche" })).toHaveValue("Verzinken");
    expect(screen.getByLabelText("Liefertermin")).toHaveValue("");
    expect(screen.queryByText("Terminvorschlag")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Oberfläche" }), { target: { value: "Vernickeln" } });
    fireEvent.change(screen.getByLabelText("Teil / Bezeichnung"), { target: { value: "Freitext" } });
    fireEvent.change(screen.getByLabelText("Teil / Bezeichnung"), { target: { value: "Synthetischer Flansch" } });
    expect(screen.getByRole("combobox", { name: "Oberfläche" })).toHaveValue("Vernickeln");

    fireEvent.change(screen.getByLabelText("Liefertermin"), { target: { value: "2026-11-20" } });
    await waitFor(() => expect(getIntakeSuggestions).toHaveBeenLastCalledWith(expect.objectContaining({ wishDate: "2026-11-20" })));
    expect(screen.getByLabelText("Liefertermin")).toHaveValue("2026-11-20");
  });

  it("keeps a failed existing-customer intake visible without false success", async () => {
    const createDirectIntake = vi.fn<GlobalCreatePorts["createDirectIntake"]>().mockResolvedValue({ code: "UNAVAILABLE", message: "Speichern nicht verfügbar." });
    const value = ports({ createDirectIntake });
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    await fillDirectIntakeForExistingCustomer();
    fireEvent.click(screen.getByRole("button", { name: "Wareneingang buchen" }));

    await waitFor(() => expect(createDirectIntake).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Speichern nicht verfügbar/)).toBeInTheDocument();
    expect(screen.getAllByText("SYNTHETISCH Musterkunde GmbH").length).toBeGreaterThan(0);
    expect(createDirectIntake).toHaveBeenCalledTimes(1);
    expect(value.createCustomer).not.toHaveBeenCalled();
  });

  it("clears an award date when editing a KV", async () => {
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);

    await openIntent("CUSTOMER");
    await fillCustomer();
    await startQuoteForExistingCustomer();
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
    await waitFor(() => expect(screen.getByLabelText("Name / Firma")).toHaveFocus());
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
    fireEvent.click(screen.getByRole("button", { name: "Gewerbe" }));
    fireEvent.change(screen.getByLabelText("Name / Firma"), { target: { value: "SYNTHETISCH Eingabe bleibt" } });
    fillRequiredCustomerAddress();
    fireEvent.click(screen.getByRole("button", { name: "Kunde speichern" }));
    expect(await screen.findByText("Kundendaten sind nicht vollständig.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name / Firma")).toHaveValue("SYNTHETISCH Eingabe bleibt");
    expect(screen.queryByRole("region", { name: "Kunden-Receipt" })).not.toBeInTheDocument();

    unmount();
    const conflictValue = ports({ convertQuote });
    render(<GlobalCreateFlow ports={conflictValue} />);
    await startQuoteForExistingCustomer();
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

    await startQuoteForExistingCustomer();
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

  it("moves focus into the dialog and closes the non-persistent intake with Escape", async () => {
    render(<GlobalCreateFlow ports={ports()} />);
    openFlow();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Kunde suchen" })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

});
