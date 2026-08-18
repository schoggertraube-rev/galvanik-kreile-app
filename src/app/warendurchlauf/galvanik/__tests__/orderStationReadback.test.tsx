import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getGalvanikOrdersAction = vi.hoisted(() => vi.fn());

vi.mock("@/app/warendurchlauf/actions", () => ({ getGalvanikOrdersAction }));
vi.mock("@/components/orders/GalvanikHandoffAttachmentPanel", () => ({
  GalvanikHandoffAttachmentPanel: () => null,
}));
vi.mock("@/components/orders/GalvanikCorrectionButton", () => ({
  GalvanikCorrectionButton: (props: {
    orderId: string;
    onConfirmedReadback: (orders: unknown[]) => void;
    onConflictReadback?: (orders: unknown[], message: string) => void;
  }) => (
    <div>
      <button onClick={() => props.onConfirmedReadback([])}>Korrektur-Test-Erfolg-{props.orderId}</button>
      <button onClick={() => props.onConflictReadback?.([], `Konflikt-${props.orderId}`)}>
        Korrektur-Test-Konflikt-{props.orderId}
      </button>
    </div>
  ),
}));
vi.mock("@/components/orders/OrderModalProvider", () => ({ useOrderModal: () => ({ openOrder: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("lucide-react", () => ({ ArrowRight: () => null, Layers: () => null, PlayCircle: () => null, CheckCircle2: () => null, AlertTriangle: () => null, Loader2: () => null, ChevronRight: () => null }));

import GalvanikPage from "../page";

const galvanikOrder = {
  id: "order-1", version: 2, orderNumber: "A-1", customerId: "customer-1", customerName: "Kunde", title: "Auftrag", task: null,
  itemDescription: "Teil", surfaceRequested: "Zink", station: "galvanik", currentStationId: "galvanik", status: "galvanik",
  statusText: "IM PLAN", risk: "green", parts: [], intakeDate: "", dueDate: "", dueLabel: "Termin", dueValue: "Nicht erfasst", createdAt: undefined,
};

const urgentGalvanikOrder = {
  ...galvanikOrder,
  id: "order-1",
  orderNumber: "A-1",
  risk: "red",
};

afterEach(() => {
  cleanup();
  getGalvanikOrdersAction.mockReset();
  vi.clearAllMocks();
});

describe("W3 Galvanik readback", () => {
  it("keeps loading free of empty success claims", async () => {
    getGalvanikOrdersAction.mockReturnValueOnce(new Promise(() => {}));
    render(<GalvanikPage />);
    expect(screen.getByText("Lade Galvanik Aufträge...")).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
    await waitFor(() => expect(getGalvanikOrdersAction).toHaveBeenCalledTimes(1));
  });

  it("renders the stable denial rather than an empty state", async () => {
    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: false, error: "FORBIDDEN", message: "Stationsliste ist nicht erlaubt." });
    render(<GalvanikPage />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Stationsliste ist nicht erlaubt."));
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
  });

  it("distinguishes denied (AUTH_ERROR/FORBIDDEN) from error (QUERY_ERROR/UNAVAILABLE/NOT_AVAILABLE)", async () => {
    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: false, error: "AUTH_ERROR", message: "Sitzung fehlt." });
    const { unmount } = render(<GalvanikPage />);
    await waitFor(() => expect(screen.getByText("Zugriff nicht erlaubt")).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Sitzung fehlt.");
    unmount();

    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: false, error: "QUERY_ERROR", message: "Nicht sicher geladen." });
    render(<GalvanikPage />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Nicht sicher geladen."));
    expect(screen.getByText("Daten konnten nicht geladen werden")).toBeInTheDocument();
    expect(screen.queryByText("Zugriff nicht erlaubt")).not.toBeInTheDocument();
  });

  it("renders a true empty state only after the fixed action succeeds", async () => {
    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [] });
    render(<GalvanikPage />);
    expect(await screen.findByText("Noch keine Daten erfasst.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aufträge anzeigen" })).toHaveAttribute("href", "/orders");
  });

  it("shows an order handed over to galvanik in the active bucket while start and completion remain unavailable", async () => {
    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [galvanikOrder] });
    render(<GalvanikPage />);
    expect(await screen.findByText("A-1")).toBeInTheDocument();
    expect(screen.getByText("Die Übergabe aus dem Wareneingang ist aktiv. Start und Abschluss bleiben NOT_AVAILABLE.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start|abschluss/i })).not.toBeInTheDocument();
  });

  it("renders the correction control for an active galvanik order and keeps its page-level success message after the card disappears", async () => {
    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [galvanikOrder] });
    render(<GalvanikPage />);
    expect(await screen.findByText("A-1")).toBeInTheDocument();
    const successButton = screen.getByText("Korrektur-Test-Erfolg-order-1");
    fireEvent.click(successButton);
    await waitFor(() => expect(screen.getByText("Rücknahme nach Wareneingang bestätigt.")).toBeInTheDocument());
    // The card is gone from the fresh (empty) list, yet the success message stays page-level.
    expect(screen.queryByText("A-1")).not.toBeInTheDocument();
  });

  it("clears a corrected order from the urgent banner (topUrgent) too, not just the bucket list, after a confirmed readback", async () => {
    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [urgentGalvanikOrder] });
    render(<GalvanikPage />);
    expect(await screen.findByText("Dringlich in Galvanik")).toBeInTheDocument();
    expect(screen.getAllByText("A-1")).toHaveLength(2); // bucket list card + urgent banner card

    fireEvent.click(screen.getByText("Korrektur-Test-Erfolg-order-1"));
    await waitFor(() => expect(screen.getByText("Rücknahme nach Wareneingang bestätigt.")).toBeInTheDocument());

    // The fresh (empty) dataset must clear the order from every derived bucket at once.
    expect(screen.queryByText("A-1")).not.toBeInTheDocument();
    expect(screen.queryByText("Dringlich in Galvanik")).not.toBeInTheDocument();
  });

  it("keeps the conflict message and offers a real reload after a correction conflict", async () => {
    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [galvanikOrder] });
    render(<GalvanikPage />);
    expect(await screen.findByText("A-1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Korrektur-Test-Konflikt-order-1"));
    await waitFor(() => expect(screen.getByText("Konflikt-order-1")).toBeInTheDocument());

    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [galvanikOrder] });
    fireEvent.click(screen.getByRole("button", { name: "Stationsliste neu laden" }));
    await waitFor(() => expect(getGalvanikOrdersAction).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Konflikt-order-1")).not.toBeInTheDocument();
  });
});
