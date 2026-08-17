import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  create: vi.fn(), search: vi.fn(), receipt: vi.fn(), orders: vi.fn(),
  attachments: vi.fn(), reserve: vi.fn(), finalize: vi.fn(), storageFrom: vi.fn(),
}));

vi.mock("@/app/warendurchlauf/actions", () => ({
  createOrderIntakeAction: ports.create,
  searchOrderIntakeCustomersAction: ports.search,
  getOrderIntakeReceiptAction: ports.receipt,
  getWareneingangOrdersAction: ports.orders,
  getOrderIntakeAttachmentsAction: ports.attachments,
  reserveOrderIntakeAttachmentAction: ports.reserve,
  finalizeOrderIntakeAttachmentAction: ports.finalize,
}));
vi.mock("@/lib/supabase/client", () => ({ supabase: { storage: { from: ports.storageFrom } } }));
vi.mock("lucide-react", () => {
  const Icon = () => null;
  return {
    AlertTriangle: Icon, CheckCircle2: Icon, Loader2: Icon, PackagePlus: Icon,
    Plus: Icon, Search: Icon, ShieldCheck: Icon, Trash2: Icon, Upload: Icon,
  };
});

import { OrderIntakePanel } from "@/components/erfassung/OrderIntakePanel";

type CreateOrderIntakeInput = Parameters<typeof import("@/app/warendurchlauf/actions").createOrderIntakeAction>[0];
type OrderIntakeCustomerInput = CreateOrderIntakeInput["customer"];

// Derives canonical/display customer fields by branching directly on the
// customer.mode discriminant, avoiding unsafe property access across the union.
function deriveCustomerFields(customer: OrderIntakeCustomerInput): {
  customerMode: "EXISTING" | "NEW";
  customerId?: string;
  canonicalCustomerName: string;
  displayName: string;
} {
  if (customer.mode === "EXISTING") {
    return {
      customerMode: "EXISTING",
      customerId: customer.customerId,
      canonicalCustomerName: "Kunde A",
      displayName: "Kunde A",
    };
  }
  return {
    customerMode: "NEW",
    customerId: undefined,
    canonicalCustomerName: customer.name,
    displayName: customer.companyName || customer.name,
  };
}

// Deterministic UUID counter shared across all test contexts
let uuidCounter = 0;
function makeReceiptForInput(input: {
  clientEventId: string;
  customerMode: string;
  customerId?: string;
  customer?: { mode: string; customerId: string };
  displayName?: string | null;
  dueDate: string;
  note: string | null;
  items: Array<{ name: string; quantity: number; material: string | null; surfaceRequested: string }>;
}) {
  const mode: "EXISTING" | "NEW" = (input.customerMode || input.customer?.mode || "EXISTING") as "EXISTING" | "NEW";
  const customerId = input.customerId || input.customer?.customerId || "customer-a";
  const displayName = input.displayName || "Kunde A";

  return {
    receiptId: `77777777-7777-4777-8777-${String(uuidCounter++).padStart(12, "0")}`,
    eventId: `44444444-4444-4444-8444-${String(uuidCounter++).padStart(12, "0")}`,
    orderId: `33333333-3333-4333-8333-${String(uuidCounter++).padStart(12, "0")}`,
    orderNumber: "A-2026-0042",
    customerId,
    customerDisplayName: displayName,
    customerMode: mode,
    clientEventId: input.clientEventId,
    correlationId: `55555555-5555-4555-8555-${String(uuidCounter++).padStart(12, "0")}`,
    actorId: `11111111-1111-4111-8111-${String(uuidCounter++).padStart(12, "0")}`,
    dueDate: input.dueDate,
    note: input.note,
    items: input.items.map((item, idx) => ({
      id: `66666666-6666-4666-8666-${String(idx).padStart(12, "0")}`,
      position: idx + 1,
      name: item.name,
      quantity: item.quantity,
      material: item.material,
      surfaceRequested: item.surfaceRequested,
    })),
    recordedAt: "2026-08-12T12:00:00.000Z",
    orderVersion: 1 as const,
    station: "wareneingang" as const,
    status: "angenommen" as const,
  };
}

// Track the active command receipt so mocks can return consistent clones
let activeCommandReceipt: ReturnType<typeof makeReceiptForInput> | null = null;
// Track canonical customer name separately for worklist order semantics
let activeCanonicalCustomerName: string = "Kunde A";

function makeWorklistOrder(overrideReceipt: ReturnType<typeof makeReceiptForInput>) {
  const canonicalDueDate = `${overrideReceipt.dueDate}T00:00:00.000Z`;
  return {
    id: overrideReceipt.orderId,
    version: 1,
    orderNumber: overrideReceipt.orderNumber,
    customerId: overrideReceipt.customerId,
    customerName: activeCanonicalCustomerName,
    title: overrideReceipt.items[0]?.name ?? "",
    task: null,
    itemDescription: null,
    surfaceRequested: null,
    station: overrideReceipt.station,
    status: overrideReceipt.status,
    statusText: "In Bearbeitung",
    risk: "normal",
    currentStationId: overrideReceipt.station,
    parts: overrideReceipt.items.map((item) => ({
      id: item.id,
      tenantId: null,
      orderId: overrideReceipt.orderId,
      customerId: overrideReceipt.customerId,
      name: item.name,
      quantity: item.quantity,
      currentStationId: overrideReceipt.station,
      material: item.material,
      surfaceRequested: item.surfaceRequested,
      photoIds: null,
      photo: null,
      repairTypes: null,
      stationSequence: null,
      currentStep: null,
      internalNotes: null,
      createdAt: new Date("2026-08-12T12:00:00.000Z"),
    })),
    intakeDate: "2026-08-12",
    dueDate: canonicalDueDate,
    dueLabel: "Termin",
    dueValue: canonicalDueDate,
    createdAt: "2026-08-12T12:00:00.000Z",
  };
}

// Helpers to transform receipts/orders for negative tests without mutating the command receipt
type TestReceipt = ReturnType<typeof makeReceiptForInput>;
type TestWorklistOrder = ReturnType<typeof makeWorklistOrder>;

function setTestField<T extends object>(target: T, field: PropertyKey, value: unknown): T {
  return Object.assign(target, { [field]: value });
}

function freshReceiptTransform(receipt: TestReceipt, transform: (receipt: TestReceipt) => TestReceipt) {
  const clone = JSON.parse(JSON.stringify(receipt)) as TestReceipt;
  return transform(clone);
}

function worklistTransform(order: TestWorklistOrder, transform: (order: TestWorklistOrder) => TestWorklistOrder) {
  const clone = JSON.parse(JSON.stringify(order)) as TestWorklistOrder;
  return transform(clone);
}

function renderPanel() {
  const onClose = vi.fn();
  const setCloseBlocked = vi.fn();
  render(<OrderIntakePanel onClose={onClose} setCloseBlocked={setCloseBlocked} />);
  return { onClose, setCloseBlocked };
}

async function completeExistingForm() {
  await screen.findByRole("combobox", { name: /Kunde auswählen/i });
  fireEvent.change(screen.getByPlaceholderText("Bezeichnung *"), { target: { value: "Grundplatte" } });
  fireEvent.change(screen.getByPlaceholderText("Menge *"), { target: { value: "2" } });
  fireEvent.change(screen.getByPlaceholderText("Werkstoff"), { target: { value: "Stahl" } });
  fireEvent.change(screen.getByPlaceholderText("Oberfläche / Behandlung *"), { target: { value: "Glanzverchromen" } });
}

async function completeTwoItemForm() {
  await screen.findByRole("combobox", { name: /Kunde auswählen/i });
  const nameInputs = screen.getAllByPlaceholderText("Bezeichnung *");
  const qtyInputs = screen.getAllByPlaceholderText("Menge *");
  const matInputs = screen.getAllByPlaceholderText("Werkstoff");
  const surfInputs = screen.getAllByPlaceholderText("Oberfläche / Behandlung *");
  fireEvent.change(nameInputs[0], { target: { value: "Grundplatte" } });
  fireEvent.change(qtyInputs[0], { target: { value: "2" } });
  fireEvent.change(matInputs[0], { target: { value: "Stahl" } });
  fireEvent.change(surfInputs[0], { target: { value: "Glanzverchromen" } });
  fireEvent.change(nameInputs[1], { target: { value: "Abdeckblech" } });
  fireEvent.change(qtyInputs[1], { target: { value: "5" } });
  fireEvent.change(matInputs[1], { target: { value: "Alu" } });
  fireEvent.change(surfInputs[1], { target: { value: "Eloxieren" } });
}

beforeEach(() => {
  vi.resetAllMocks();
  uuidCounter = 0;
  activeCommandReceipt = null;
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => `${String(uuidCounter++).padStart(4, "0")}-0000-4000-8000-000000000000`),
    subtle: { digest: vi.fn() },
  });
  ports.search.mockResolvedValue({
    ok: true,
    data: {
      customers: [{ id: "customer-a", customerNumber: "K-1", name: "Kunde A", companyName: null, customerType: "business", contactPerson: null, email: null, phone: null, city: "Köln" }],
      canCreateCustomer: true,
    },
  });
  // Dynamic: command receipt built from form input, stored for fresh reads
  ports.create.mockImplementation(async (input: CreateOrderIntakeInput) => {
    const { customerMode, customerId, canonicalCustomerName, displayName } = deriveCustomerFields(input.customer);
    activeCanonicalCustomerName = canonicalCustomerName;
    activeCommandReceipt = makeReceiptForInput({
      clientEventId: input.clientEventId,
      customerMode,
      customerId,
      displayName,
      dueDate: input.dueDate || "2026-08-12",
      note: input.note || null,
      items: input.items || [],
    });
    return {
      code: "OK",
      receipt: activeCommandReceipt,
      replayed: false,
    };
  });
  // Dynamic: fresh receipt is a structurally independent deep clone of the command receipt
  ports.receipt.mockImplementation(async () => ({
    ok: true,
    data: activeCommandReceipt ? JSON.parse(JSON.stringify(activeCommandReceipt)) : null,
  }));
  // Dynamic: worklist order built from command receipt clone
  ports.orders.mockImplementation(async () => ({
    ok: true,
    data: activeCommandReceipt ? [JSON.parse(JSON.stringify(makeWorklistOrder(activeCommandReceipt)))] : [],
  }));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("F1.1 digitaler Wareneingang", () => {
  it("shows loading, empty and denial without pretending that data exists", async () => {
    ports.search.mockResolvedValueOnce({ ok: true, data: { customers: [], canCreateCustomer: true } });
    renderPanel();
    expect(screen.getByRole("status")).toHaveTextContent("Kunden werden geladen");
    expect(await screen.findByText(/Noch keine passenden Kunden erfasst/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Kunde auswählen/i })).not.toBeInTheDocument();
    cleanup();

    ports.search.mockResolvedValueOnce({ ok: false, error: "FORBIDDEN", message: "Rolle darf keinen Wareneingang anlegen." });
    renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent("Rolle darf keinen Wareneingang anlegen");
    expect(ports.create).not.toHaveBeenCalled();
  });

  it("shows success only after exact receipt and station-list readback", async () => {
    const { setCloseBlocked } = renderPanel();
    await completeExistingForm();
    fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

    await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
    expect(setCloseBlocked).toHaveBeenCalledWith(true);
    const createArg = ports.create.mock.calls[0][0];
    expect(createArg.clientEventId).toEqual(expect.any(String));
    expect(createArg.customer).toEqual({ mode: "EXISTING", customerId: "customer-a" });
    expect(createArg.items).toEqual([{ name: "Grundplatte", quantity: 2, material: "Stahl", surfaceRequested: "Glanzverchromen" }]);
    expect(await screen.findByRole("heading", { name: `${activeCommandReceipt!.orderNumber} bestätigt` })).toBeInTheDocument();
    expect(ports.receipt).toHaveBeenCalledWith({ orderId: activeCommandReceipt!.orderId, clientEventId: createArg.clientEventId });
    expect(ports.orders).toHaveBeenCalledTimes(1);
    expect(setCloseBlocked).toHaveBeenLastCalledWith(false);
  });

  it("uses the server-canonical whitespace form for a new customer and item", async () => {
    renderPanel();
    const newCustomerButton = await screen.findByRole("button", { name: "Neu anlegen" });
    await waitFor(() => expect(newCustomerButton).toBeEnabled());
    fireEvent.click(newCustomerButton);
    fireEvent.change(screen.getByPlaceholderText("Kundenname *"), { target: { value: "Meyer  Betrieb" } });
    fireEvent.change(screen.getByPlaceholderText("Firmenname"), { target: { value: "Meyer   GmbH" } });
    fireEvent.change(screen.getByPlaceholderText("Bezeichnung *"), { target: { value: "Grundplatte  A" } });
    fireEvent.change(screen.getByPlaceholderText("Menge *"), { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("Werkstoff"), { target: { value: "Stahl   1.4301" } });
    fireEvent.change(screen.getByPlaceholderText(/Behandlung/), { target: { value: "Glanz  verchromen" } });

    ports.create.mockImplementationOnce(async (input: CreateOrderIntakeInput) => {
      if (input.customer.mode !== "NEW") throw new Error("Expected NEW customer input");
      const canonicalCustomerName = input.customer.name;
      const displayName = input.customer.companyName || input.customer.name;
      activeCanonicalCustomerName = canonicalCustomerName;
      activeCommandReceipt = makeReceiptForInput({
        clientEventId: input.clientEventId,
        customerMode: input.customer.mode,
        customerId: "22222222-2222-4222-8222-222222222222",
        displayName,
        dueDate: input.dueDate,
        note: input.note,
        items: input.items,
      });
      return { code: "OK", receipt: activeCommandReceipt, replayed: false };
    });

    fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

    await screen.findByRole("heading", { name: /A-2026-0042/ });
    const createArg = ports.create.mock.calls[0][0];
    expect(createArg.customer).toEqual({
      mode: "NEW",
      name: "Meyer Betrieb",
      customerType: "business",
      companyName: "Meyer GmbH",
      contactPerson: null,
      email: null,
      phone: null,
      city: null,
    });
    expect(createArg.items).toEqual([{
      name: "Grundplatte A",
      quantity: 2,
      material: "Stahl 1.4301",
      surfaceRequested: "Glanz verchromen",
    }]);
  });

  it("accepts readback when NEW customer companyName differs from name (canonical customer name contract)", async () => {
    // Regression: ensure order.customerName matches canonical name (not companyName)
    renderPanel();
    const newCustomerButton = await screen.findByRole("button", { name: "Neu anlegen" });
    await waitFor(() => expect(newCustomerButton).toBeEnabled());
    fireEvent.click(newCustomerButton);
    fireEvent.change(screen.getByPlaceholderText("Kundenname *"), { target: { value: "Betrieb Müller" } });
    fireEvent.change(screen.getByPlaceholderText("Firmenname"), { target: { value: "Müller & Söhne GmbH" } });
    fireEvent.change(screen.getByPlaceholderText("Bezeichnung *"), { target: { value: "Achse" } });
    fireEvent.change(screen.getByPlaceholderText("Menge *"), { target: { value: "3" } });
    fireEvent.change(screen.getByPlaceholderText(/Behandlung/), { target: { value: "Verzinken" } });

    // Mock returns: receipt displayName uses companyName, order customerName uses canonical name
    ports.create.mockImplementationOnce(async (input: CreateOrderIntakeInput) => {
      if (input.customer.mode !== "NEW") throw new Error("Expected NEW customer input");
      const canonicalCustomerName = input.customer.name; // "Betrieb Müller"
      const displayName = input.customer.companyName; // "Müller & Söhne GmbH"
      activeCanonicalCustomerName = canonicalCustomerName;
      activeCommandReceipt = makeReceiptForInput({
        clientEventId: input.clientEventId,
        customerMode: input.customer.mode,
        customerId: "33333333-3333-4333-8333-333333333333",
        displayName,
        dueDate: input.dueDate,
        note: input.note,
        items: input.items,
      });
      return { code: "OK", receipt: activeCommandReceipt, replayed: false };
    });

    fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

    await screen.findByRole("heading", { name: /A-2026-0042/ });
    const createArg = ports.create.mock.calls[0][0];
    expect(createArg.customer).toEqual({
      mode: "NEW",
      name: "Betrieb Müller",
      customerType: "business",
      companyName: "Müller & Söhne GmbH",
      contactPerson: null,
      email: null,
      phone: null,
      city: null,
    });
    // Verify the success heading and that companyName appears in receipt detail
    expect(screen.getByRole("heading", { name: /A-2026-0042 bestätigt/ })).toBeInTheDocument();
    expect(screen.getByText(/Müller & Söhne GmbH/)).toBeInTheDocument();
  });

  it("keeps conflict truthful and never runs a false readback", async () => {
    ports.create.mockResolvedValueOnce({ code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." });
    const { setCloseBlocked } = renderPanel();
    await completeExistingForm();
    fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Anfragekennung wurde bereits anders verwendet");
    expect(ports.receipt).not.toHaveBeenCalled();
    expect(ports.orders).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: /A-\d{4}-\d+ bestätigt/ })).not.toBeInTheDocument();
    expect(setCloseBlocked).toHaveBeenNthCalledWith(1, true);
    expect(setCloseBlocked).toHaveBeenLastCalledWith(false);
  });

  it("positive readback with 2 items from separately cloned receipt/order", async () => {
    // Add second item via button before filling form
    renderPanel();
    await screen.findByRole("combobox", { name: /Kunde auswählen/i });
    const addButtons = screen.getAllByRole("button").filter((btn) => btn.textContent?.includes("Teil") && btn.getAttribute("type") === "button" && !btn.getAttribute("aria-label"));
    fireEvent.click(addButtons[0]);
    await completeTwoItemForm();

    // Override create to build a 2-item receipt matching exactly what the form sends
    ports.create.mockImplementationOnce(async (input: CreateOrderIntakeInput) => {
      const { customerMode, customerId, canonicalCustomerName, displayName } = deriveCustomerFields(input.customer);
      activeCanonicalCustomerName = canonicalCustomerName;
      activeCommandReceipt = makeReceiptForInput({
        clientEventId: input.clientEventId,
        customerMode,
        customerId,
        displayName,
        dueDate: input.dueDate || "2026-08-12",
        note: input.note || null,
        items: input.items || [], // Form sends 2 items now
      });
      return {
        code: "OK",
        receipt: activeCommandReceipt,
        replayed: false,
      };
    });

    fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

    await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("heading", { name: /A-2026-0042 bestätigt/ })).toBeInTheDocument();
    expect(ports.receipt).toHaveBeenCalledTimes(1);
    expect(ports.orders).toHaveBeenCalledTimes(1);
  });

  describe("Blocker A: lost-response idempotency", () => {
    it("retains clientEventId across error, exception, and unknown response until readback confirms", async () => {
      // First attempt: create throws (simulating network error after server-side commit)
      ports.create.mockRejectedValueOnce(new Error("network timeout"));
      renderPanel();
      await completeExistingForm();
      fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));
      await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
      const firstClientEventId = ports.create.mock.calls[0][0].clientEventId;

      // Wait for error state so submitting.current is false
      await screen.findByRole("alert");

      // Second attempt: unchanged form, same clientEventId returned from server
      ports.create.mockImplementationOnce(async (input: CreateOrderIntakeInput) => {
        const { customerMode, customerId, canonicalCustomerName, displayName } = deriveCustomerFields(input.customer);
        activeCanonicalCustomerName = canonicalCustomerName;
        activeCommandReceipt = makeReceiptForInput({
          clientEventId: firstClientEventId,
          customerMode,
          customerId,
          displayName,
          dueDate: input.dueDate || "2026-08-12",
          note: input.note || null,
          items: input.items || [],
        });
        return {
          code: "OK",
          receipt: activeCommandReceipt,
          replayed: true,
        };
      });

      fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));
      await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(2));
      const secondClientEventId = ports.create.mock.calls[1][0].clientEventId;

      expect(secondClientEventId).toBe(firstClientEventId);
      await screen.findByRole("heading", { name: /A-2026-0042 bestätigt/ });
    });

    it("generates new clientEventId when form content materially changes after error", async () => {
      ports.create.mockRejectedValueOnce(new Error("network timeout"));
      renderPanel();
      await completeExistingForm();
      fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));
      await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
      const firstClientEventId = ports.create.mock.calls[0][0].clientEventId;

      await screen.findByRole("alert");

      // Materially change the form: different surface
      fireEvent.change(screen.getByPlaceholderText("Oberfläche / Behandlung *"), { target: { value: "Mattverchromen" } });

      // Second create: dynamic mock returns receipt with new clientEventId and updated surface
      ports.create.mockImplementationOnce(async (input: CreateOrderIntakeInput) => {
        const { customerMode, customerId, canonicalCustomerName, displayName } = deriveCustomerFields(input.customer);
        activeCanonicalCustomerName = canonicalCustomerName;
        activeCommandReceipt = makeReceiptForInput({
          clientEventId: input.clientEventId,
          customerMode,
          customerId,
          displayName,
          dueDate: input.dueDate || "2026-08-12",
          note: input.note || null,
          items: input.items || [],
        });
        return {
          code: "OK",
          receipt: activeCommandReceipt,
          replayed: false,
        };
      });

      fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));
      await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(2));
      const secondClientEventId = ports.create.mock.calls[1][0].clientEventId;

      expect(secondClientEventId).not.toBe(firstClientEventId);
    });

    it("double-click / parallel submit results in exactly one action call", async () => {
      let resolveCreate: (value: unknown) => void;
      ports.create.mockImplementationOnce((input: CreateOrderIntakeInput) => new Promise((resolve) => {
        // Capture input for later use
        const { customerMode, customerId, canonicalCustomerName, displayName } = deriveCustomerFields(input.customer);
        activeCanonicalCustomerName = canonicalCustomerName;
        activeCommandReceipt = makeReceiptForInput({
          clientEventId: input.clientEventId,
          customerMode,
          customerId,
          displayName,
          dueDate: input.dueDate || "2026-08-12",
          note: input.note || null,
          items: input.items || [],
        });
        resolveCreate = (value) => resolve(value);
      }));
      renderPanel();
      await completeExistingForm();

      // Two rapid clicks
      fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));
      fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

      // Wait until create was called to get the actual clientEventId
      await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
      // Resolve the deferred create with correct clientEventId and activeCommandReceipt
      resolveCreate!({ code: "OK", receipt: activeCommandReceipt, replayed: false });

      await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
      await screen.findByRole("heading", { name: /A-2026-0042 bestätigt/ });
    });
  });

  describe("Blocker P1: wrong-but-equal — command receipt and fresh receipt agree but mismatch input", () => {
    it("rejects before fresh read when command receipt carries wrong but valid clientEventId", async () => {
      const wrongButValidUuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      ports.create.mockResolvedValueOnce({
        code: "OK",
        receipt: { ...activeCommandReceipt!, clientEventId: wrongButValidUuid },
        replayed: false,
      });
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      renderPanel();
      await completeExistingForm();
      fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

      await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      // Fresh reads must NOT happen — both receipt and orders
      expect(ports.receipt).not.toHaveBeenCalled();
      expect(ports.orders).not.toHaveBeenCalled();
      expect(screen.queryByRole("heading", { name: /bestätigt/ })).not.toBeInTheDocument();
      expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "order-intake:created" }));
    });
  });

  describe("Blocker B: exact fresh readback — receipt scalar negative matrix", () => {
    let dispatchSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => { dispatchSpy = vi.spyOn(window, "dispatchEvent"); });

    const receiptScalarFields = [
      ["receiptId", "wrong-receipt-id"],
      ["eventId", "wrong-event-id"],
      ["orderId", "wrong-order-id"],
      ["orderNumber", "A-9999-9999"],
      ["customerId", "wrong-customer"],
      ["customerDisplayName", "Falscher Kunde"],
      ["customerMode", "NEW"],
      ["clientEventId", "wrong-client-event-id"],
      ["correlationId", "wrong-correlation-id"],
      ["actorId", "wrong-actor-id"],
      ["dueDate", "2099-01-01"],
      ["note", "unexpected note"],
      ["orderVersion", 2],
      ["station", "galvanik"],
      ["status", "completed"],
      ["recordedAt", "2099-01-01T00:00:00.000Z"],
    ] as const;

    for (const [field, wrongValue] of receiptScalarFields) {
      it(`rejects readback when receipt.${field} mismatches`, async () => {
        ports.receipt.mockImplementationOnce(async () => {
          const tampered = freshReceiptTransform(activeCommandReceipt!, (r) => {
            return setTestField(r, field, wrongValue);
          });
          return { ok: true, data: tampered };
        });
        renderPanel();
        await completeExistingForm();
        fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

        await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
        expect(await screen.findByRole("alert")).toHaveTextContent(/Readback/i);
        expect(screen.queryByRole("heading", { name: /bestätigt/ })).not.toBeInTheDocument();
        expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "order-intake:created" }));
      });
    }
  });

  describe("Blocker B: exact fresh readback — receipt item field negative matrix", () => {
    let dispatchSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => { dispatchSpy = vi.spyOn(window, "dispatchEvent"); });

    const itemFields = [
      ["id", "wrong-item-id"],
      ["position", 99],
      ["name", "Falsches Teil"],
      ["quantity", 999],
      ["material", "Plastik"],
      ["surfaceRequested", "Falsche Behandlung"],
    ] as const;

    for (const [field, wrongValue] of itemFields) {
      it(`rejects readback when receipt item.${field} mismatches`, async () => {
        ports.receipt.mockImplementationOnce(async () => {
          const tampered = freshReceiptTransform(activeCommandReceipt!, (r) => {
            r.items = r.items.map((item, idx) =>
              idx === 0 ? { ...item, [field]: wrongValue } : { ...item },
            );
            return r;
          });
          return { ok: true, data: tampered };
        });
        renderPanel();
        await completeExistingForm();
        fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

        await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
        expect(await screen.findByRole("alert")).toHaveTextContent(/Readback/i);
        expect(screen.queryByRole("heading", { name: /bestätigt/ })).not.toBeInTheDocument();
        expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "order-intake:created" }));
      });
    }
  });

  describe("Blocker B: exact fresh readback — worklist order field negative matrix", () => {
    let dispatchSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => { dispatchSpy = vi.spyOn(window, "dispatchEvent"); });

    const orderFields = [
      ["id", "wrong-order-id"],
      ["orderNumber", "A-9999-9999"],
      ["version", 2],
      ["customerId", "wrong-customer"],
      ["customerName", "Falscher Kunde"],
      ["dueDate", "2099-01-01"],
      ["station", "galvanik"],
      ["currentStationId", "galvanik"],
      ["status", "completed"],
    ] as const;

    for (const [field, wrongValue] of orderFields) {
      it(`rejects readback when worklist order.${field} mismatches`, async () => {
        ports.orders.mockImplementationOnce(async () => {
          const tamperedOrder = worklistTransform(makeWorklistOrder(activeCommandReceipt!), (o) => {
            return setTestField(o, field, wrongValue);
          });
          return { ok: true, data: [tamperedOrder] };
        });
        renderPanel();
        await completeExistingForm();
        fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

        await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
        expect(await screen.findByRole("alert")).toHaveTextContent(/Readback/i);
        expect(screen.queryByRole("heading", { name: /bestätigt/ })).not.toBeInTheDocument();
        expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "order-intake:created" }));
      });
    }
  });

  describe("Blocker B: exact fresh readback — worklist parts negative matrix", () => {
    let dispatchSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => { dispatchSpy = vi.spyOn(window, "dispatchEvent"); });

    const partFields = [
      ["id", "wrong-part-id"],
      ["name", "Falsches Teil"],
      ["quantity", 999],
      ["material", "Plastik"],
      ["surfaceRequested", "Falsche Behandlung"],
    ] as const;

    for (const [field, wrongValue] of partFields) {
      it(`rejects readback when worklist part.${field} mismatches`, async () => {
        ports.orders.mockImplementationOnce(async () => {
          const tamperedOrder = worklistTransform(makeWorklistOrder(activeCommandReceipt!), (o) => {
            o.parts = o.parts.map((part, idx) =>
              idx === 0 ? { ...part, [field]: wrongValue } : { ...part },
            );
            return o;
          });
          return { ok: true, data: [tamperedOrder] };
        });
        renderPanel();
        await completeExistingForm();
        fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

        await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
        expect(await screen.findByRole("alert")).toHaveTextContent(/Readback/i);
        expect(screen.queryByRole("heading", { name: /bestätigt/ })).not.toBeInTheDocument();
        expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "order-intake:created" }));
      });
    }

    it("rejects readback when worklist has extra part", async () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      ports.orders.mockImplementationOnce(async () => {
        const tamperedOrder = worklistTransform(makeWorklistOrder(activeCommandReceipt!), (o) => {
          o.parts = [...o.parts, { ...o.parts[0], id: "extra-part-id" }];
          return o;
        });
        return { ok: true, data: [tamperedOrder] };
      });
      renderPanel();
      await completeExistingForm();
      fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

      await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
      expect(await screen.findByRole("alert")).toHaveTextContent(/Readback/i);
      expect(screen.queryByRole("heading", { name: /bestätigt/ })).not.toBeInTheDocument();
      expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "order-intake:created" }));
    });

    it("rejects readback when worklist has missing part", async () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      ports.orders.mockImplementationOnce(async () => {
        const tamperedOrder = worklistTransform(makeWorklistOrder(activeCommandReceipt!), (o) => {
          o.parts = [];
          return o;
        });
        return { ok: true, data: [tamperedOrder] };
      });
      renderPanel();
      await completeExistingForm();
      fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

      await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
      expect(await screen.findByRole("alert")).toHaveTextContent(/Readback/i);
      expect(screen.queryByRole("heading", { name: /bestätigt/ })).not.toBeInTheDocument();
      expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "order-intake:created" }));
    });
  });

  describe("F1.1 dueDate canonical ISO comparison (regression)", () => {
    let dispatchSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => { dispatchSpy = vi.spyOn(window, "dispatchEvent"); });

    it("accepts readback when worklist dueDate is canonical UTC-midnight ISO", async () => {
      renderPanel();
      await completeExistingForm();
      fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

      await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
      expect(await screen.findByRole("heading", { name: /A-2026-0042 bestätigt/ })).toBeInTheDocument();
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "order-intake:created" }));
    });

    it("rejects readback when worklist dueDate has non-midnight time", async () => {
      ports.orders.mockImplementationOnce(async () => {
        const tamperedOrder = worklistTransform(makeWorklistOrder(activeCommandReceipt!), (o) => {
          o.dueDate = `${o.dueDate.substring(0, 10)}T12:30:45.000Z`;
          return o;
        });
        return { ok: true, data: [tamperedOrder] };
      });
      renderPanel();
      await completeExistingForm();
      fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

      await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
      expect(await screen.findByRole("alert")).toHaveTextContent(/Readback/i);
      expect(screen.queryByRole("heading", { name: /bestätigt/ })).not.toBeInTheDocument();
      expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "order-intake:created" }));
    });

    it("rejects readback when worklist dueDate is adjacent date at midnight", async () => {
      ports.orders.mockImplementationOnce(async () => {
        const tamperedOrder = worklistTransform(makeWorklistOrder(activeCommandReceipt!), (o) => {
          const orderDate = new Date(o.dueDate);
          orderDate.setUTCDate(orderDate.getUTCDate() + 1);
          o.dueDate = orderDate.toISOString();
          return o;
        });
        return { ok: true, data: [tamperedOrder] };
      });
      renderPanel();
      await completeExistingForm();
      fireEvent.click(screen.getByRole("button", { name: "Wareneingang anlegen" }));

      await waitFor(() => expect(ports.create).toHaveBeenCalledTimes(1));
      expect(await screen.findByRole("alert")).toHaveTextContent(/Readback/i);
      expect(screen.queryByRole("heading", { name: /bestätigt/ })).not.toBeInTheDocument();
      expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "order-intake:created" }));
    });
  });
});
