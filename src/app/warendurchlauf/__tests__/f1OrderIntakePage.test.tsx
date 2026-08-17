import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  kpis: vi.fn(),
  orders: vi.fn(),
  openErfassung: vi.fn(),
  handoffProps: undefined as undefined | {
    onConflictReadback?: (orders: unknown[], message: string) => void;
  },
}));

vi.mock("@/app/warendurchlauf/actions", () => ({
  getWarendurchlaufKPIs: ports.kpis,
  getWareneingangOrdersAction: ports.orders,
}));
vi.mock("@/components/erfassung/ErfassungProvider", () => ({
  useErfassung: () => ({ openErfassung: ports.openErfassung }),
}));
vi.mock("@/components/orders/OrderCompactCard", () => ({ OrderCompactCard: () => <div /> }));
vi.mock("@/components/orders/WareneingangHandoffButton", () => ({
  WareneingangHandoffButton: (props: {
    onConflictReadback?: (orders: unknown[], message: string) => void;
  }) => {
    ports.handoffProps = props;
    return (
      <button
        type="button"
        onClick={() => props.onConflictReadback?.([], "Auftrag wurde bereits geändert.")}
      >
        Konflikt auslösen
      </button>
    );
  },
}));
vi.mock("@/lib/orders/getUrgency", () => ({ getUrgency: () => "ok" }));
vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: () => ({ openOrder: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("lucide-react", () => {
  const Icon = () => null;
  return { Camera: Icon, PenLine: Icon, Phone: Icon, MessageSquare: Icon, Clock: Icon, ChevronRight: Icon, Zap: Icon };
});

import WareneingangPage from "@/app/warendurchlauf/wareneingang/page";

beforeEach(() => {
  vi.resetAllMocks();
  ports.kpis.mockResolvedValue({ ok: true, data: { orders: [] } });
  ports.orders.mockResolvedValue({ ok: true, data: [] });
  ports.handoffProps = undefined;
});

afterEach(() => cleanup());

describe("F1.1 Wareneingang placement", () => {
  it("opens exactly the order-intake flow and reloads the real station port after confirmation", async () => {
    render(<WareneingangPage />);
    await waitFor(() => expect(ports.orders).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /Wareneingang anlegen/i }));
    expect(ports.openErfassung).toHaveBeenCalledTimes(1);
    expect(ports.openErfassung).toHaveBeenCalledWith({ mode: "order" });

    window.dispatchEvent(new CustomEvent("order-intake:created", { detail: { orderId: "order-a" } }));
    await waitFor(() => expect(ports.orders).toHaveBeenCalledTimes(2));
  });

  it("keeps the real handoff conflict visible after the fresh read removes the order card", async () => {
    ports.orders.mockResolvedValueOnce({
      ok: true,
      data: [{
        id: "order-conflict",
        version: 1,
        orderNumber: "A-2026-0001",
        customerName: "Kunde",
        itemDescription: "Teil",
        surfaceRequested: "Zink",
        risk: "green",
        dueDate: "",
        dueValue: "Nicht erfasst",
        dueLabel: "Termin",
        status: "angenommen",
      }],
    });

    render(<WareneingangPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Konflikt auslösen" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Konflikt auslösen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Auftrag wurde bereits geändert.");
    expect(screen.getByText(/Noch keine Daten erfasst/)).toBeInTheDocument();
  });
});
