import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/customers/CustomerCardAppAdapter", () => ({
  CustomerCardAppAdapter: ({ customerId, fallbackHref }: { customerId: string; fallbackHref: string }) => (
    <div><span>{customerId}</span><span>{fallbackHref}</span></div>
  ),
}));
import CustomerDetailPage from "../page";

describe("Customers V2 deeplink", () => {
  it("bindet die ID und den deterministischen Rückweg zur Kundenliste", async () => {
    render(await CustomerDetailPage({ params: Promise.resolve({ id: "customer-7" }) }));
    expect(screen.getByText("customer-7")).toBeVisible();
    expect(screen.getByText("/customers")).toBeVisible();
  });
});
