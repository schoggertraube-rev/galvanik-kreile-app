import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/orders/OrderCardAppAdapter", () => ({
  OrderCardAppAdapter: ({ orderId, fallbackHref }: { orderId: string; fallbackHref: string }) => (
    <div data-testid="order-adapter">{`${orderId}|${fallbackHref}`}</div>
  ),
}));

vi.mock("@/app/customers/CustomerCardAppAdapter", () => ({
  CustomerCardAppAdapter: ({ customerId, fallbackHref }: { customerId: string; fallbackHref: string }) => (
    <div data-testid="customer-adapter">{`${customerId}|${fallbackHref}`}</div>
  ),
}));

import CustomerDetailPage from "@/app/customers/[id]/page";
import OrderDetailPage from "@/app/orders/[id]/page";

afterEach(cleanup);

describe("P3 detail deep links", () => {
  it("uses the shared V8 order adapter with a deterministic list fallback", async () => {
    render(await OrderDetailPage({ params: Promise.resolve({ id: "order-1" }) }));
    expect(screen.getByTestId("order-adapter")).toHaveTextContent("order-1|/orders");
  });

  it("uses the shared V2 customer adapter with a deterministic list fallback", async () => {
    render(await CustomerDetailPage({ params: Promise.resolve({ id: "customer-1" }) }));
    expect(screen.getByTestId("customer-adapter")).toHaveTextContent("customer-1|/customers");
  });
});
