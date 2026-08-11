import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const usePageView = vi.fn();
const ordersGetAll = vi.fn();
const customersGetAll = vi.fn();
const timelineGetForOrder = vi.fn();
const orderActionGrid = vi.fn();
const orderTimeline = vi.fn();
const orderProfitabilityCard = vi.fn();
const stationCompletionModal = vi.fn();
const labelPrintView = vi.fn();
const erfassungCard = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push }),
}));
vi.mock("@/hooks/usePageView", () => ({ usePageView }));
vi.mock("@/lib/repositories/ordersRepository", () => ({
  ordersRepository: { getAll: ordersGetAll },
}));
vi.mock("@/lib/repositories/customersRepository", () => ({
  customersRepository: { getAll: customersGetAll },
}));
vi.mock("@/lib/repositories/timelineRepository", () => ({
  timelineRepository: { getForOrder: timelineGetForOrder },
}));
vi.mock("@/components/orders/OrderActionGrid", () => ({ OrderActionGrid: orderActionGrid }));
vi.mock("@/components/orders/OrderTimeline", () => ({ OrderTimeline: orderTimeline }));
vi.mock("@/components/orders/OrderProfitabilityCard", () => ({
  OrderProfitabilityCard: orderProfitabilityCard,
}));
vi.mock("@/components/orders/StationCompletionModal", () => ({
  StationCompletionModal: stationCompletionModal,
}));
vi.mock("@/components/orders/LabelPrintView", () => ({ LabelPrintView: labelPrintView }));
vi.mock("@/components/erfassung/ErfassungCard", () => ({ ErfassungCard: erfassungCard }));

import OrderDetailPage from "../page";

const denialMessage =
  "NOT_AVAILABLE: Auftragsdetailansicht benötigt einen tenant- und ownership-geprüften W3-Read-Vertrag.";
const routeSource = readFileSync(resolve(process.cwd(), "src/app/orders/[id]/page.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);
const expectedFailClosedRouteSource = [
  'import { BackButton } from "@/components/ui/BackButton";',
  'import { Breadcrumb } from "@/components/ui/Breadcrumb";',
  "",
  "const denialMessage =",
  `  "${denialMessage}";`,
  "",
  "export default function OrderDetailPage() {",
  "  return (",
  '    <div className="min-h-screen bg-transparent p-4 md:p-8">',
  '      <div className="mb-6">',
  "        <Breadcrumb",
  "          items={[",
  '            { label: "Home", href: "/" },',
  '            { label: "Orders", href: "/orders" },',
  '            { label: "Auftragsdetail" },',
  "          ]}",
  "        />",
  '        <BackButton label="Orders" href="/orders" />',
  "      </div>",
  "",
  "      <section",
  '        className="max-w-2xl rounded-3xl border-2 border-amber-300 bg-amber-50 p-6 shadow-sm md:p-8"',
  '        aria-labelledby="order-detail-denial-title"',
  "      >",
  "        <h1",
  '          id="order-detail-denial-title"',
  '          className="font-serif text-2xl font-black text-amber-950"',
  "        >",
  "          Auftragsdetail nicht verfügbar",
  "        </h1>",
  '        <p className="mt-3 text-base font-semibold leading-relaxed text-amber-900">',
  "          {denialMessage}",
  "        </p>",
  "      </section>",
  "    </div>",
  "  );",
  "}",
  "",
].join("\n");

describe("W2C order detail fail-closed route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the exact denial with real breadcrumb and back navigation", () => {
    render(<OrderDetailPage />);

    expect(screen.getByText(denialMessage)).toBeVisible();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(breadcrumb).getByRole("link", { name: "Orders" })).toHaveAttribute(
      "href",
      "/orders",
    );
    fireEvent.click(screen.getByRole("button", { name: "Zurück zur Orders" }));
    expect(push).toHaveBeenCalledExactlyOnceWith("/orders");
  });

  it("locks the complete fail-closed route shape and invokes no former detail path", () => {
    expect(routeSource).toBe(expectedFailClosedRouteSource);

    render(<OrderDetailPage />);

    expect(usePageView).not.toHaveBeenCalled();
    expect(ordersGetAll).not.toHaveBeenCalled();
    expect(customersGetAll).not.toHaveBeenCalled();
    expect(timelineGetForOrder).not.toHaveBeenCalled();
    expect(orderActionGrid).not.toHaveBeenCalled();
    expect(orderTimeline).not.toHaveBeenCalled();
    expect(orderProfitabilityCard).not.toHaveBeenCalled();
    expect(stationCompletionModal).not.toHaveBeenCalled();
    expect(labelPrintView).not.toHaveBeenCalled();
    expect(erfassungCard).not.toHaveBeenCalled();
  });
});
