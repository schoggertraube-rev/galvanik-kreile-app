import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WareneingangHandoffButton } from "../WareneingangHandoffButton";

const transitionSpy = vi.hoisted(() => vi.fn());
const getWareneingangSpy = vi.hoisted(() => vi.fn());
const getGalvanikSpy = vi.hoisted(() => vi.fn());
const getReceiptSpy = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/orders.actions", () => ({
  transitionWareneingangToGalvanikAction: transitionSpy,
}));
vi.mock("@/app/warendurchlauf/actions", () => ({
  getWareneingangOrdersAction: getWareneingangSpy,
  getGalvanikOrdersAction: getGalvanikSpy,
  getOrderStationReceiptAction: getReceiptSpy,
}));

const CLIENT_EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as `${string}-${string}-${string}-${string}-${string}`;
const SECOND_CLIENT_EVENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd" as `${string}-${string}-${string}-${string}-${string}`;
const receipt = {
  eventId: "event-1",
  clientEventId: CLIENT_EVENT_ID,
  correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  eventSchemaVersion: 1,
  orderId: "order-1",
  aggregateVersion: 2,
  fromStation: "wareneingang",
  toStation: "galvanik",
  actorId: "11111111-1111-4111-8111-111111111111",
  occurredAt: "2026-08-11T15:47:32.000Z",
} as const;

const targetOrder = {
  id: "order-1",
  version: 2,
  orderNumber: "A-1",
  customerId: "customer-1",
  customerName: "Kunde",
  title: "Auftrag",
  task: null,
  itemDescription: null,
  surfaceRequested: null,
  station: "galvanik",
  status: "ready",
  statusText: "IM PLAN",
  risk: "green",
  currentStationId: "galvanik",
  parts: [],
  intakeDate: "",
  dueDate: "",
  dueLabel: "Termin",
  dueValue: "Nicht erfasst",
  createdAt: undefined,
};

function renderButton() {
  const onConfirmedReadback = vi.fn();
  const onConflictReadback = vi.fn();
  render(
    <WareneingangHandoffButton
      orderId="order-1"
      expectedVersion={1}
      onConfirmedReadback={onConfirmedReadback}
      onConflictReadback={onConflictReadback}
    />,
  );
  return { onConfirmedReadback, onConflictReadback };
}

beforeEach(() => {
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(CLIENT_EVENT_ID);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("WareneingangHandoffButton", () => {
  it("sends the exact id and optimistic version once while pending", async () => {
    let resolveTransition!: (value: { code: "UNAUTHENTICATED"; message: string }) => void;
    transitionSpy.mockReturnValueOnce(new Promise((resolve) => { resolveTransition = resolve; }));
    const { onConfirmedReadback } = renderButton();
    const button = screen.getByRole("button", { name: "An Galvanik übergeben" });

    fireEvent.click(button);
    fireEvent.click(button);
    expect(transitionSpy).toHaveBeenCalledTimes(1);
    expect(transitionSpy).toHaveBeenCalledWith({
      orderId: "order-1",
      expectedVersion: 1,
      clientEventId: CLIENT_EVENT_ID,
    });
    expect(button).toBeDisabled();

    resolveTransition({ code: "UNAUTHENTICATED", message: "Sitzung fehlt." });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sitzung fehlt."));
    expect(onConfirmedReadback).not.toHaveBeenCalled();
  });

  it("keeps the id for the same order/version retry and rotates it when the order changes", async () => {
    vi.mocked(globalThis.crypto.randomUUID)
      .mockReturnValueOnce(CLIENT_EVENT_ID)
      .mockReturnValueOnce(SECOND_CLIENT_EVENT_ID);
    transitionSpy.mockResolvedValue({ code: "UNAVAILABLE", message: "Nicht bestätigt." });
    const onConfirmedReadback = vi.fn();
    const { rerender } = render(
      <WareneingangHandoffButton
        orderId="order-1"
        expectedVersion={1}
        onConfirmedReadback={onConfirmedReadback}
      />,
    );
    const button = screen.getByRole("button", { name: "An Galvanik übergeben" });

    fireEvent.click(button);
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(transitionSpy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(transitionSpy.mock.calls[0]?.[0].clientEventId).toBe(CLIENT_EVENT_ID);
    expect(transitionSpy.mock.calls[1]?.[0].clientEventId).toBe(CLIENT_EVENT_ID);

    rerender(
      <WareneingangHandoffButton
        orderId="order-2"
        expectedVersion={1}
        onConfirmedReadback={onConfirmedReadback}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "An Galvanik übergeben" }));
    await waitFor(() => expect(transitionSpy).toHaveBeenCalledTimes(3));
    expect(transitionSpy.mock.calls[2]?.[0]).toMatchObject({
      orderId: "order-2",
      expectedVersion: 1,
      clientEventId: SECOND_CLIENT_EVENT_ID,
    });
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(2);
  });

  it.each(["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "VALIDATION_ERROR", "UNAVAILABLE"] as const)(
    "shows %s without a success mutation or readback",
    async (code) => {
      transitionSpy.mockResolvedValueOnce({ code, message: `${code} denied` });
      const { onConfirmedReadback } = renderButton();
      fireEvent.click(screen.getByRole("button", { name: "An Galvanik übergeben" }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(`${code} denied`));
      expect(getWareneingangSpy).not.toHaveBeenCalled();
      expect(getGalvanikSpy).not.toHaveBeenCalled();
      expect(onConfirmedReadback).not.toHaveBeenCalled();
    },
  );

  it("reports a thrown command without claiming success", async () => {
    transitionSpy.mockRejectedValueOnce(new Error("network"));
    const { onConfirmedReadback } = renderButton();
    fireEvent.click(screen.getByRole("button", { name: "An Galvanik übergeben" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Übergabe ist derzeit nicht verfügbar."));
    expect(onConfirmedReadback).not.toHaveBeenCalled();
  });

  it("confirms success only after both fresh reads prove source removal, target state, and version", async () => {
    transitionSpy.mockResolvedValueOnce({ code: "OK", receipt, replayed: false });
    getWareneingangSpy.mockResolvedValueOnce({ ok: true, data: [] });
    getGalvanikSpy.mockResolvedValueOnce({ ok: true, data: [targetOrder] });
    getReceiptSpy.mockResolvedValueOnce({ ok: true, data: receipt });
    const { onConfirmedReadback } = renderButton();

    fireEvent.click(screen.getByRole("button", { name: "An Galvanik übergeben" }));
    await waitFor(() => expect(onConfirmedReadback).toHaveBeenCalledWith([]));
    expect(getWareneingangSpy).toHaveBeenCalledTimes(1);
    expect(getGalvanikSpy).toHaveBeenCalledTimes(1);
    expect(getReceiptSpy).toHaveBeenCalledWith({
      orderId: "order-1",
      clientEventId: CLIENT_EVENT_ID,
    });
    expect(screen.getByRole("status")).toHaveTextContent("Übergabe an Galvanik bestätigt.");
  });

  it.each([
    ["missing", null],
    ["foreign", { ...receipt, orderId: "other-order" }],
    ["mismatched", { ...receipt, correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }],
  ])("does not claim success for a %s persisted receipt despite correct source and target reads", async (_case, persisted) => {
    transitionSpy.mockResolvedValueOnce({ code: "OK", receipt, replayed: false });
    getWareneingangSpy.mockResolvedValueOnce({ ok: true, data: [] });
    getGalvanikSpy.mockResolvedValueOnce({ ok: true, data: [targetOrder] });
    getReceiptSpy.mockResolvedValueOnce({ ok: true, data: persisted });
    const { onConfirmedReadback } = renderButton();

    fireEvent.click(screen.getByRole("button", { name: "An Galvanik übergeben" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Übergabe wurde nicht bestätigt; erneut prüfen."));
    expect(onConfirmedReadback).not.toHaveBeenCalled();
  });

  it("reuses the stable client event id and does not mutate the list after an unconfirmed readback", async () => {
    transitionSpy.mockResolvedValueOnce({ code: "OK", receipt, replayed: false });
    getWareneingangSpy.mockResolvedValueOnce({ ok: true, data: [targetOrder] });
    getGalvanikSpy.mockResolvedValueOnce({ ok: true, data: [targetOrder] });
    getReceiptSpy.mockResolvedValueOnce({ ok: true, data: receipt });
    const { onConfirmedReadback } = renderButton();
    const button = screen.getByRole("button", { name: "An Galvanik übergeben" });

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Übergabe wurde nicht bestätigt; erneut prüfen."));
    expect(onConfirmedReadback).not.toHaveBeenCalled();
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    await waitFor(() => expect(transitionSpy).toHaveBeenCalledTimes(2));
    expect(transitionSpy.mock.calls[0]?.[0].clientEventId).toBe(CLIENT_EVENT_ID);
    expect(transitionSpy.mock.calls[1]?.[0].clientEventId).toBe(CLIENT_EVENT_ID);
  });

  it("reports no success and leaves a safe retry available when either fresh read rejects", async () => {
    transitionSpy.mockResolvedValueOnce({ code: "OK", receipt, replayed: false });
    getWareneingangSpy.mockRejectedValueOnce(new Error("source unavailable"));
    getGalvanikSpy.mockResolvedValueOnce({ ok: true, data: [targetOrder] });
    const { onConfirmedReadback } = renderButton();
    const button = screen.getByRole("button", { name: "An Galvanik übergeben" });

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Übergabe wurde nicht bestätigt; erneut prüfen."));
    expect(onConfirmedReadback).not.toHaveBeenCalled();
    expect(button).not.toBeDisabled();
  });

  it("refreshes Wareneingang once on conflict and remains visibly conflicted", async () => {
    transitionSpy.mockResolvedValueOnce({ code: "CONFLICT", message: "Auftrag wurde bereits geändert." });
    getWareneingangSpy.mockResolvedValueOnce({ ok: true, data: [] });
    const { onConfirmedReadback, onConflictReadback } = renderButton();

    fireEvent.click(screen.getByRole("button", { name: "An Galvanik übergeben" }));
    await waitFor(() => expect(onConflictReadback).toHaveBeenCalledWith([]));
    expect(onConfirmedReadback).not.toHaveBeenCalled();
    expect(getGalvanikSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Auftrag wurde bereits geändert.");
  });
});
