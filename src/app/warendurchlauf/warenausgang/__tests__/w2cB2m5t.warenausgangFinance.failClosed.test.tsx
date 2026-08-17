import { readFile } from "node:fs/promises";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getOrdersDbMock, openOrderMock } = vi.hoisted(() => ({
  getOrdersDbMock: vi.fn(),
  openOrderMock: vi.fn(),
}));

vi.mock("@/app/actions/orders.actions", () => ({ getOrdersDb: getOrdersDbMock }));
vi.mock("@/components/orders/OrderModalProvider", () => ({ useOrderModal: () => ({ openOrder: openOrderMock }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("lucide-react", () => ({
  CheckCircle2: () => <svg />,
  Package: () => <svg />,
  Truck: () => <svg />,
  MessageSquare: () => <svg />,
  CreditCard: () => <svg />,
}));

import WarenausgangPage from "../page";

const denial = "NOT_AVAILABLE: Zahlungsstatus, Zahlungserfassung, Rechnungsversand und Kundenbenachrichtigungen benötigen einen tenant- und ownership-geprüften Accounting- und Kommunikationsvertrag.";
const sourcePath = "src/app/warendurchlauf/warenausgang/page.tsx";
const source = () => readFile(path.resolve(process.cwd(), sourcePath), "utf8");
const order = (id: string, station: string, risk: string) => ({
  id,
  station,
  currentStationId: station,
  risk,
  orderNumber: `A-${id}`,
  customerName: `Kunde ${id}`,
  title: `Titel ${id}`,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("W2C-B2M5T Warenausgang Finance Truth", () => {
  it("renders only station orders, preserves row opening, and exposes no finance or communication side effect", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    getOrdersDbMock.mockResolvedValue({ ok: true, data: [
      order("green", "warenausgang", "green"),
      order("amber", "warenausgang", "amber"),
      order("other", "produktion", "green"),
    ] });

    render(<WarenausgangPage />);

    const rows = await screen.findAllByTestId("warenausgang-order-row");
    expect(rows).toHaveLength(2);
    expect(screen.queryByText("Kunde other")).not.toBeInTheDocument();
    expect(screen.queryByText("Bezahlt")).not.toBeInTheDocument();
    expect(screen.queryByText("Offen")).not.toBeInTheDocument();
    fireEvent.click(rows[0]);
    expect(openOrderMock).toHaveBeenCalledWith("green");

    for (const label of ["Kundenbenachrichtigung", "Zahlungsstatus / Zahlungserfassung", "Rechnungsversand"]) {
      const control = screen.getByRole("button", { name: label });
      expect(control).toBeDisabled();
      expect(control.onclick).toBeNull();
      fireEvent.click(control);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders the exact denial for a non-ok result without a false empty state or row", async () => {
    getOrdersDbMock.mockResolvedValue({ ok: false, error: "UNAUTHORIZED", message: "denied" });
    render(<WarenausgangPage />);

    expect(await screen.findByTestId("warenausgang-unavailable")).toHaveTextContent(denial);
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
    expect(screen.queryByTestId("warenausgang-order-row")).not.toBeInTheDocument();
  });

  it("renders the exact denial for a rejected read without an unhandled false empty state", async () => {
    getOrdersDbMock.mockRejectedValue(new Error("read denied"));
    render(<WarenausgangPage />);

    expect(await screen.findByTestId("warenausgang-unavailable")).toHaveTextContent(denial);
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
    expect(screen.queryByTestId("warenausgang-order-row")).not.toBeInTheDocument();
  });

  it("keeps loading distinct until a confirmed empty successful read completes", async () => {
    let resolveOrders: (value: { ok: true; data: [] }) => void = () => undefined;
    getOrdersDbMock.mockReturnValue(new Promise((resolve) => { resolveOrders = resolve; }));
    render(<WarenausgangPage />);

    expect(screen.getByText("Aufträge werden geladen")).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
    resolveOrders({ ok: true, data: [] });
    await waitFor(() => expect(screen.getByText("Noch keine Aufträge erfasst")).toBeInTheDocument());
  });

  it("removes the finance and communication ports, claims, and risk-to-payment mapping from the page source", async () => {
    const pageSource = await source();
    for (const forbidden of [
      "/api/kommzentrale/invoice",
      "fetch(",
      "PaymentDrawer",
      "sendInvoice",
      "sendingInvoice",
      "orderData={{}}",
      "risk ===",
      "Bezahlt",
      "Offen",
      "Automatischer Rechnungsversand",
      "Kontaktlos",
      "Benachrichtigung senden",
    ]) {
      expect(pageSource).not.toContain(forbidden);
    }
    expect(pageSource).toContain("getOrdersDb");
    expect(pageSource).toContain('order.station === "warenausgang" || order.currentStationId === "warenausgang"');
    expect(pageSource).toContain("openOrder(order.id)");
  });
});
