import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GalvanikCorrectionButton } from "../GalvanikCorrectionButton";

const correctSpy = vi.hoisted(() => vi.fn());
const getWareneingangSpy = vi.hoisted(() => vi.fn());
const getGalvanikSpy = vi.hoisted(() => vi.fn());
const getReceiptSpy = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/orders.actions", () => ({
  correctGalvanikToWareneingangAction: correctSpy,
}));
vi.mock("@/app/warendurchlauf/actions", () => ({
  getWareneingangOrdersAction: getWareneingangSpy,
  getGalvanikOrdersAction: getGalvanikSpy,
  getOrderStationCorrectionReceiptAction: getReceiptSpy,
}));

const CLIENT_EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as `${string}-${string}-${string}-${string}-${string}`;
const SECOND_CLIENT_EVENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd" as `${string}-${string}-${string}-${string}-${string}`;
const REASON = "Falsche Station gebucht";

const receipt = {
  eventId: "event-1",
  clientEventId: CLIENT_EVENT_ID,
  correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  eventSchemaVersion: 1,
  orderId: "order-1",
  aggregateVersion: 3,
  fromStation: "galvanik",
  toStation: "wareneingang",
  actorId: "11111111-1111-4111-8111-111111111111",
  occurredAt: "2026-08-17T09:12:00.000Z",
  reason: REASON,
} as const;

const sourceOrder = {
  id: "order-1",
  version: 3,
  orderNumber: "A-1",
  customerId: "customer-1",
  customerName: "Kunde",
  title: "Auftrag",
  task: null,
  itemDescription: null,
  surfaceRequested: null,
  station: "wareneingang",
  status: "angenommen",
  statusText: "WARTEND",
  risk: "green",
  currentStationId: "wareneingang",
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
    <GalvanikCorrectionButton
      orderId="order-1"
      expectedVersion={2}
      onConfirmedReadback={onConfirmedReadback}
      onConflictReadback={onConflictReadback}
    />,
  );
  return { onConfirmedReadback, onConflictReadback };
}

function openForm() {
  fireEvent.click(screen.getByRole("button", { name: "Zurück nach Wareneingang" }));
}

beforeEach(() => {
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(CLIENT_EVENT_ID);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("GalvanikCorrectionButton", () => {
  it("rejects a blank reason without calling the command", () => {
    renderButton();
    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Korrektur bestätigen" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/5 und 500 Zeichen/);
    expect(correctSpy).not.toHaveBeenCalled();
  });

  it("rejects a too-short trimmed reason without calling the command", () => {
    renderButton();
    openForm();
    fireEvent.change(screen.getByLabelText("Begründung der Korrektur"), { target: { value: "  ab  " } });
    fireEvent.click(screen.getByRole("button", { name: "Korrektur bestätigen" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/5 und 500 Zeichen/);
    expect(correctSpy).not.toHaveBeenCalled();
  });

  it("enforces maxLength=500 on the reason field", () => {
    renderButton();
    openForm();
    expect(screen.getByLabelText("Begründung der Korrektur")).toHaveAttribute("maxLength", "500");
  });

  it.each(["UNAUTHENTICATED", "FORBIDDEN", "VALIDATION_ERROR", "UNAVAILABLE"] as const)(
    "shows %s without any fresh readback or success claim",
    async (code) => {
      correctSpy.mockResolvedValueOnce({ code, message: `${code} denied` });
      const { onConfirmedReadback } = renderButton();
      openForm();
      fireEvent.change(screen.getByLabelText("Begründung der Korrektur"), { target: { value: REASON } });
      fireEvent.click(screen.getByRole("button", { name: "Korrektur bestätigen" }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(`${code} denied`));
      expect(getWareneingangSpy).not.toHaveBeenCalled();
      expect(getGalvanikSpy).not.toHaveBeenCalled();
      expect(getReceiptSpy).not.toHaveBeenCalled();
      expect(onConfirmedReadback).not.toHaveBeenCalled();
    },
  );

  it("refreshes the galvanik list on conflict and keeps the conflict message visible", async () => {
    correctSpy.mockResolvedValueOnce({ code: "CONFLICT", message: "Auftrag wurde bereits geändert." });
    getGalvanikSpy.mockResolvedValueOnce({ ok: true, data: [sourceOrder] });
    const { onConfirmedReadback, onConflictReadback } = renderButton();
    openForm();
    fireEvent.change(screen.getByLabelText("Begründung der Korrektur"), { target: { value: REASON } });
    fireEvent.click(screen.getByRole("button", { name: "Korrektur bestätigen" }));

    await waitFor(() =>
      expect(onConflictReadback).toHaveBeenCalledWith([sourceOrder], "Auftrag wurde bereits geändert."),
    );
    expect(onConfirmedReadback).not.toHaveBeenCalled();
    expect(getWareneingangSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Auftrag wurde bereits geändert.");
  });

  it("confirms success only after exact source, target, and receipt readback", async () => {
    correctSpy.mockResolvedValueOnce({ code: "OK", receipt, replayed: false });
    getWareneingangSpy.mockResolvedValueOnce({ ok: true, data: [sourceOrder] });
    getGalvanikSpy.mockResolvedValueOnce({ ok: true, data: [] });
    getReceiptSpy.mockResolvedValueOnce({ ok: true, data: receipt });
    const { onConfirmedReadback } = renderButton();
    openForm();
    fireEvent.change(screen.getByLabelText("Begründung der Korrektur"), { target: { value: REASON } });
    fireEvent.click(screen.getByRole("button", { name: "Korrektur bestätigen" }));

    await waitFor(() => expect(onConfirmedReadback).toHaveBeenCalledWith([]));
    expect(getReceiptSpy).toHaveBeenCalledWith({ orderId: "order-1", clientEventId: CLIENT_EVENT_ID });
    expect(correctSpy).toHaveBeenCalledWith({
      orderId: "order-1",
      expectedVersion: 2,
      clientEventId: CLIENT_EVENT_ID,
      reason: REASON,
    });
    expect(screen.getByRole("status")).toHaveTextContent("Rücknahme nach Wareneingang bestätigt.");
  });

  it.each([
    ["missing", null],
    ["foreign", { ...receipt, orderId: "other-order" }],
    ["mismatched-reason", { ...receipt, reason: "andere Begründung" }],
  ])("never claims success for a %s persisted receipt despite correct source and target reads", async (_case, persisted) => {
    correctSpy.mockResolvedValueOnce({ code: "OK", receipt, replayed: false });
    getWareneingangSpy.mockResolvedValueOnce({ ok: true, data: [sourceOrder] });
    getGalvanikSpy.mockResolvedValueOnce({ ok: true, data: [] });
    getReceiptSpy.mockResolvedValueOnce({ ok: true, data: persisted });
    const { onConfirmedReadback } = renderButton();
    openForm();
    fireEvent.change(screen.getByLabelText("Begründung der Korrektur"), { target: { value: REASON } });
    fireEvent.click(screen.getByRole("button", { name: "Korrektur bestätigen" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Rücknahme wurde nicht bestätigt; erneut prüfen."),
    );
    expect(onConfirmedReadback).not.toHaveBeenCalled();
  });

  it("keeps the client event id stable for the same intent and rotates it when the reason changes", async () => {
    vi.mocked(globalThis.crypto.randomUUID)
      .mockReturnValueOnce(CLIENT_EVENT_ID)
      .mockReturnValueOnce(SECOND_CLIENT_EVENT_ID);
    correctSpy.mockResolvedValue({ code: "UNAVAILABLE", message: "Nicht verfügbar." });
    renderButton();
    openForm();
    const textarea = screen.getByLabelText("Begründung der Korrektur");
    fireEvent.change(textarea, { target: { value: REASON } });

    fireEvent.click(screen.getByRole("button", { name: "Korrektur bestätigen" }));
    await waitFor(() => expect(correctSpy).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Korrektur bestätigen" }));
    await waitFor(() => expect(correctSpy).toHaveBeenCalledTimes(2));
    expect(correctSpy.mock.calls[0]?.[0].clientEventId).toBe(CLIENT_EVENT_ID);
    expect(correctSpy.mock.calls[1]?.[0].clientEventId).toBe(CLIENT_EVENT_ID);

    fireEvent.change(textarea, { target: { value: "Andere Begründung als vorher" } });
    fireEvent.click(screen.getByRole("button", { name: "Korrektur bestätigen" }));
    await waitFor(() => expect(correctSpy).toHaveBeenCalledTimes(3));
    expect(correctSpy.mock.calls[2]?.[0].clientEventId).toBe(SECOND_CLIENT_EVENT_ID);
  });
});
