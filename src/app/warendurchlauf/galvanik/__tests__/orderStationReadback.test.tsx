import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getGalvanikOrdersAction = vi.hoisted(() => vi.fn());

vi.mock("@/app/warendurchlauf/actions", () => ({ getGalvanikOrdersAction }));
vi.mock("@/components/orders/OrderModalProvider", () => ({ useOrderModal: () => ({ openOrder: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("lucide-react", () => ({ ArrowRight: () => null, Layers: () => null, PlayCircle: () => null, CheckCircle2: () => null, AlertTriangle: () => null, Loader2: () => null, ChevronRight: () => null }));

import GalvanikPage from "../page";

const readyOrder = {
  id: "order-1", version: 2, orderNumber: "A-1", customerId: "customer-1", customerName: "Kunde", title: "Auftrag", task: null,
  itemDescription: "Teil", surfaceRequested: "Zink", station: "galvanik", currentStationId: "galvanik", status: "ready",
  statusText: "IM PLAN", risk: "green", parts: [], intakeDate: "", dueDate: "", dueLabel: "Termin", dueValue: "Nicht erfasst", createdAt: undefined,
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("W3 Galvanik readback", () => {
  it("keeps loading free of empty success claims", () => {
    getGalvanikOrdersAction.mockReturnValueOnce(new Promise(() => {}));
    render(<GalvanikPage />);
    expect(screen.getByText("Lade Galvanik Aufträge...")).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
  });

  it("renders the stable denial rather than an empty state", async () => {
    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: false, error: "FORBIDDEN", message: "Stationsliste ist nicht erlaubt." });
    render(<GalvanikPage />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Stationsliste ist nicht erlaubt."));
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
  });

  it("renders a true empty state only after the fixed action succeeds", async () => {
    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [] });
    render(<GalvanikPage />);
    expect(await screen.findByText("Noch keine Daten erfasst.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aufträge anzeigen" })).toHaveAttribute("href", "/orders");
  });

  it("shows a re-readied order in the ready bucket while start and completion remain unavailable", async () => {
    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [readyOrder] });
    render(<GalvanikPage />);
    expect(await screen.findByText("A-1")).toBeInTheDocument();
    expect(screen.getByText("Die Übergabe aus dem Wareneingang ist aktiv. Start und Abschluss bleiben NOT_AVAILABLE.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start|abschluss/i })).not.toBeInTheDocument();
  });
});
