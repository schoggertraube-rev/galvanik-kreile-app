import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/orders/OrderCardAppAdapter", () => ({
  OrderCardAppAdapter: ({ orderId, onOpenCustomer, onClose }: { orderId: string; onOpenCustomer: (id: string) => void; onClose: () => void }) => (
    <div data-testid="mock-order-card"><span>{orderId}</span><button onClick={() => onOpenCustomer("customer-1")}>Kunde öffnen</button><button onClick={onClose}>Zurück</button></div>
  ),
}));
vi.mock("@/app/customers/CustomerCardAppAdapter", () => ({
  CustomerCardAppAdapter: ({ customerId, onOpenOrder, onClose }: { customerId: string; onOpenOrder: (id: string) => void; onClose: () => void }) => (
    <div data-testid="mock-customer-card"><span>{customerId}</span><button onClick={() => onOpenOrder("order-2")}>Auftrag öffnen</button><button onClick={onClose}>Zurück</button></div>
  ),
}));

import { EntityOverlayStack } from "../EntityOverlayStack";
import { useOverlayStore } from "@/lib/overlayStore";

beforeEach(() => useOverlayStore.setState({ stack: [], orderStack: [] }));

describe("P3 shared entity overlay/backstack", () => {
  it("keeps Home -> order -> customer -> order and every back step on one stack", () => {
    render(<EntityOverlayStack />);
    act(() => useOverlayStore.getState().openOrder("order-1"));
    expect(screen.getByTestId("mock-order-card")).toHaveTextContent("order-1");
    fireEvent.click(screen.getByRole("button", { name: "Kunde öffnen" }));
    expect(screen.getByTestId("mock-customer-card")).toHaveTextContent("customer-1");
    fireEvent.click(screen.getByRole("button", { name: "Auftrag öffnen" }));
    expect(screen.getByTestId("mock-order-card")).toHaveTextContent("order-2");
    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    expect(screen.getByTestId("mock-customer-card")).toHaveTextContent("customer-1");
    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    expect(screen.getByTestId("mock-order-card")).toHaveTextContent("order-1");
  });

  it("opens customer -> active order and closes to the originating customer", () => {
    render(<EntityOverlayStack />);
    act(() => useOverlayStore.getState().openCustomer("customer-1"));
    fireEvent.click(screen.getByRole("button", { name: "Auftrag öffnen" }));
    expect(screen.getByTestId("mock-order-card")).toHaveTextContent("order-2");
    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    expect(screen.getByTestId("mock-customer-card")).toHaveTextContent("customer-1");
  });
});
