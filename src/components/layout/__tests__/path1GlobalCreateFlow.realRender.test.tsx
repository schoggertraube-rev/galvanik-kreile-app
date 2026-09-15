import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GlobalCreateFlow,
  type GlobalCreatePorts,
} from "@/components/layout/GlobalCreateFlow";

const CUSTOMER_ID = "72d8c6c6-397c-4a9c-b464-d2e5595eb42a";
const QUOTE_ID = "1c32e174-8494-46f0-9f5f-1a45f2a60bd1";
const ORDER_ID = "b6b493d0-3e70-4a73-88eb-367106068e62";

function quote(status: "draft" | "converted" = "draft") {
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
  };
}

function ports(overrides: Partial<GlobalCreatePorts> = {}): GlobalCreatePorts {
  return {
    canCreateCustomer: true,
    canCreateQuote: true,
    roleLabel: "Büro",
    resumeQuoteId: null,
    listCustomers: vi.fn().mockResolvedValue({ code: "OK", customers: [{ id: CUSTOMER_ID, customerNumber: "K-2026-0042", name: "SYNTHETISCH Musterkunde GmbH", city: "Teststadt" }] }),
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
    readQuote: vi.fn().mockResolvedValue({ code: "OK", quote: quote() }),
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
    rememberQuote: vi.fn(),
    openCustomer: vi.fn(),
    openOrder: vi.fn(),
    switchProfile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function openFlow() {
  fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));
}

async function fillCustomer() {
  fireEvent.click(screen.getByRole("button", { name: /Kunde anlegen/ }));
  fireEvent.change(screen.getByLabelText("Firma / Name"), { target: { value: "SYNTHETISCH Musterkunde GmbH" } });
  fireEvent.change(screen.getByLabelText("Firmenname"), { target: { value: "SYNTHETISCH Musterkunde GmbH" } });
  fireEvent.change(screen.getByLabelText("Ansprechpartner"), { target: { value: "Testperson" } });
  fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "kunde@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Ort"), { target: { value: "Teststadt" } });
  fireEvent.click(screen.getByRole("button", { name: /Neukunde speichern/ }));
  await screen.findByRole("heading", { name: /SYNTHETISCH Musterkunde GmbH · K-2026-0042/ });
}

async function fillQuote() {
  fireEvent.click(screen.getByRole("button", { name: /KV \/ Angebot anlegen/ }));
  fireEvent.change(screen.getByLabelText("Teil / Bezeichnung"), { target: { value: "Synthetischer Flansch" } });
  fireEvent.change(screen.getByLabelText("Material"), { target: { value: "Stahl" } });
  fireEvent.change(screen.getByLabelText("Oberfläche"), { target: { value: "Verzinken" } });
  fireEvent.change(screen.getByLabelText("Netto je Stück"), { target: { value: "125,00" } });
  fireEvent.change(screen.getByLabelText("Gewünschter Termin"), { target: { value: "2026-10-15" } });
  fireEvent.change(screen.getByLabelText("Hinweis zum KV"), { target: { value: "SYNTHETISCHER KV" } });
  fireEvent.click(screen.getByRole("button", { name: /KV sichern/ }));
  await screen.findByRole("heading", { name: "KV-2026-0042 gesichert" });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("PATH1 V5 globaler Kunde-KV-Auftrag-Fluss", () => {
  it("reaches the first manual customer field in two clicks and completes both receipt readbacks", async () => {
    const value = ports();
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    await fillCustomer();
    expect(value.createCustomer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("region", { name: "Kunden-Receipt" })).toHaveTextContent("fc8ccfbb-40cf-4050-b4ef-d2b979d9eef5");

    await fillQuote();
    expect(value.createQuote).toHaveBeenCalledWith(expect.objectContaining({
      customerId: CUSTOMER_ID,
      dueDate: "2026-10-15",
      positions: [expect.objectContaining({ quantity: 1, unitPriceCents: 12_500 })],
    }));
    expect(value.rememberQuote).toHaveBeenCalledWith(QUOTE_ID);
    expect(screen.getByText(/kanonisch 250,00\s€ netto/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Zuschlag bestätigen/ }));
    await screen.findByRole("heading", { name: "Auftrag A-2026-0061 angelegt" });
    expect(value.convertQuote).toHaveBeenCalledWith(expect.objectContaining({ quoteId: QUOTE_ID, expectedVersion: 1, confirmedAward: true }));
    expect(value.rememberQuote).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("region", { name: "KV-Zuschlagsreceipt" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "F1.1-Auftragsreceipt" })).toHaveTextContent(ORDER_ID);
    fireEvent.click(screen.getByRole("button", { name: "Auftragskarte öffnen" }));
    expect(value.openOrder).toHaveBeenCalledWith(ORDER_ID);
  });

  it("keeps validation input and the client event id stable across an explicit status check", async () => {
    const successfulCreate = ports().createCustomer;
    let attempt = 0;
    const createCustomer = vi.fn<GlobalCreatePorts["createCustomer"]>(async (input) => {
      attempt += 1;
      if (attempt === 1) throw new Error("network interrupted");
      return successfulCreate(input);
    });
    const value = ports({ createCustomer });
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    fireEvent.click(screen.getByRole("button", { name: /Kunde anlegen/ }));
    fireEvent.change(screen.getByLabelText("Firma / Name"), { target: { value: "SYNTHETISCH Bleibt erhalten" } });
    fireEvent.click(screen.getByRole("button", { name: /Neukunde speichern/ }));
    expect(await screen.findByText("Ausgang ungeklärt", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByLabelText("Firma / Name")).toHaveValue("SYNTHETISCH Bleibt erhalten");
    fireEvent.click(screen.getByRole("button", { name: "Status mit gleicher Kennung prüfen" }));
    await screen.findByRole("heading", { name: /SYNTHETISCH Bleibt erhalten · K-2026-0042/ });
    expect(createCustomer).toHaveBeenCalledTimes(2);
    expect(createCustomer.mock.calls[0][0].clientEventId).toBe(createCustomer.mock.calls[1][0].clientEventId);
  });

  it("never calls commands for readonly and offers a safe profile switch", async () => {
    const value = ports({ canCreateCustomer: false, canCreateQuote: false, roleLabel: "Nur Leserechte" });
    render(<GlobalCreateFlow ports={value} />);

    openFlow();
    fireEvent.click(screen.getByRole("button", { name: /Kunde anlegen/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Büro oder Administration");
    fireEvent.click(screen.getByRole("button", { name: "Zum sicheren Profilwechsel" }));
    await waitFor(() => expect(value.switchProfile).toHaveBeenCalledTimes(1));
    expect(value.createCustomer).not.toHaveBeenCalled();
    expect(value.createQuote).not.toHaveBeenCalled();
    expect(value.convertQuote).not.toHaveBeenCalled();
  });

  it("loads only real customer choices and resumes a persisted quote after reload", async () => {
    const value = ports({ resumeQuoteId: QUOTE_ID });
    render(<GlobalCreateFlow ports={value} />);
    openFlow();

    fireEvent.click(screen.getByRole("button", { name: /Gespeicherten KV fortsetzen/ }));
    await screen.findByRole("heading", { name: "KV-2026-0042 gesichert" });
    expect(value.readQuote).toHaveBeenCalledWith({ quoteId: QUOTE_ID });
    expect(screen.getByText(/nach Reload aus der Datenbank zurückgelesen/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zur Auswahl" }));
    fireEvent.click(screen.getByRole("button", { name: /Auftrag \/ KV anlegen/ }));
    const search = await screen.findByLabelText("Kunde suchen");
    fireEvent.change(search, { target: { value: "Teststadt" } });
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: /SYNTHETISCH Musterkunde/ })).toBeInTheDocument();
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

    openFlow();
    fireEvent.click(screen.getByRole("button", { name: /Kunde anlegen/ }));
    fireEvent.change(screen.getByLabelText("Firma / Name"), { target: { value: "SYNTHETISCH Eingabe bleibt" } });
    fireEvent.click(screen.getByRole("button", { name: /Neukunde speichern/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Kundendaten sind nicht vollständig");
    expect(screen.getByLabelText("Firma / Name")).toHaveValue("SYNTHETISCH Eingabe bleibt");
    expect(screen.queryByRole("region", { name: "Kunden-Receipt" })).not.toBeInTheDocument();

    unmount();
    const conflictValue = ports({ convertQuote });
    render(<GlobalCreateFlow ports={conflictValue} />);
    openFlow();
    await fillCustomer();
    await fillQuote();
    fireEvent.click(screen.getByRole("button", { name: /Zuschlag bestätigen/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Der KV wurde zwischenzeitlich geändert");
    expect(screen.getByRole("heading", { name: "KV-2026-0042 gesichert" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "F1.1-Auftragsreceipt" })).not.toBeInTheDocument();
    expect(conflictValue.openOrder).not.toHaveBeenCalled();
  });

  it("moves focus into the dialog and closes it with Escape", async () => {
    render(<GlobalCreateFlow ports={ports()} />);
    openFlow();
    await waitFor(() => expect(screen.getByRole("button", { name: /Kunde anlegen/ })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

});
