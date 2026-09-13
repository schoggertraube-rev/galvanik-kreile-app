import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/orders/OrderCardAppAdapter", () => ({
  OrderCardAppAdapter: ({ orderId, fallbackHref }: { orderId: string; fallbackHref: string }) => (
    <div><span>{orderId}</span><span>{fallbackHref}</span></div>
  ),
}));
import OrderDetailPage from "../page";

describe("Orders V8 deeplink", () => {
  it("bindet die ID und den deterministischen Rückweg zur Auftragsliste", async () => {
    render(await OrderDetailPage({ params: Promise.resolve({ id: "order-7" }) }));
    expect(screen.getByText("order-7")).toBeVisible();
    expect(screen.getByText("/orders")).toBeVisible();
  });
});
