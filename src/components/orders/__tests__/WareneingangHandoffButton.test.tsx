import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WareneingangHandoffButton } from "../WareneingangHandoffButton";

const transitionSpy = vi.hoisted(() => vi.fn());
const getWareneingangSpy = vi.hoisted(() => vi.fn());
const getGalvanikSpy = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/orders.actions", () => ({
  transitionWareneingangToGalvanikAction: transitionSpy,
}));
vi.mock("@/app/warendurchlauf/actions", () => ({
  getWareneingangOrdersAction: getWareneingangSpy,
  getGalvanikOrdersAction: getGalvanikSpy,
}));

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

afterEach(() => vi.clearAllMocks());

describe("WareneingangHandoffButton", () => {
  it("sends the exact id and optimistic version once while pending", async () => {
    let resolveTransition!: (value: { code: "UNAUTHENTICATED"; message: string }) => void;
    transitionSpy.mockReturnValueOnce(new Promise((resolve) => { resolveTransition = resolve; }));
    const { onConfirmedReadback } = renderButton();
    const button = screen.getByRole("button", { name: "An Galvanik übergeben" });

    fireEvent.click(button);
    fireEvent.click(button);
    expect(transitionSpy).toHaveBeenCalledTimes(1);
    expect(transitionSpy).toHaveBeenCalledWith({ orderId: "order-1", expectedVersion: 1 });
    expect(button).toBeDisabled();

    resolveTransition({ code: "UNAUTHENTICATED", message: "Sitzung fehlt." });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sitzung fehlt."));
    expect(onConfirmedReadback).not.toHaveBeenCalled();
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
    transitionSpy.mockResolvedValueOnce({ code: "OK", orderId: "order-1", version: 2 });
    getWareneingangSpy.mockResolvedValueOnce({ ok: true, data: [] });
    getGalvanikSpy.mockResolvedValueOnce({ ok: true, data: [targetOrder] });
    const { onConfirmedReadback } = renderButton();

    fireEvent.click(screen.getByRole("button", { name: "An Galvanik übergeben" }));
    await waitFor(() => expect(onConfirmedReadback).toHaveBeenCalledWith([]));
    expect(getWareneingangSpy).toHaveBeenCalledTimes(1);
    expect(getGalvanikSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Übergabe an Galvanik bestätigt.");
  });

  it("blocks retry and does not mutate the list on mismatched or failed confirmation reads", async () => {
    transitionSpy.mockResolvedValueOnce({ code: "OK", orderId: "order-1", version: 2 });
    getWareneingangSpy.mockResolvedValueOnce({ ok: true, data: [targetOrder] });
    getGalvanikSpy.mockResolvedValueOnce({ ok: true, data: [targetOrder] });
    const { onConfirmedReadback } = renderButton();
    const button = screen.getByRole("button", { name: "An Galvanik übergeben" });

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Übergabe wurde nicht bestätigt; bitte Liste neu laden."));
    expect(onConfirmedReadback).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(transitionSpy).toHaveBeenCalledTimes(1);
  });

  it("blocks retry and reports no success when either fresh read rejects", async () => {
    transitionSpy.mockResolvedValueOnce({ code: "OK", orderId: "order-1", version: 2 });
    getWareneingangSpy.mockRejectedValueOnce(new Error("source unavailable"));
    getGalvanikSpy.mockResolvedValueOnce({ ok: true, data: [targetOrder] });
    const { onConfirmedReadback } = renderButton();
    const button = screen.getByRole("button", { name: "An Galvanik übergeben" });

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Übergabe wurde nicht bestätigt; bitte Liste neu laden."));
    expect(onConfirmedReadback).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
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
