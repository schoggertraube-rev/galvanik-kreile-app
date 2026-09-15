import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getGalvanikOrdersAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/warendurchlauf/actions", () => ({ getGalvanikOrdersAction }));
vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: () => vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("lucide-react", () => {
  const Icon = () => null;
  return {
    ArrowRight: Icon,
    Layers: Icon,
    CheckCircle2: Icon,
    AlertTriangle: Icon,
    Loader2: Icon,
    ChevronRight: Icon,
  };
});

import { OrderQueueRow } from "../ui/OrderQueueRow";
import GalvanikPage from "@/app/warendurchlauf/galvanik/page";

afterEach(() => {
  cleanup();
  getGalvanikOrdersAction.mockReset();
  vi.clearAllMocks();
});

const unavailable =
  "NOT_AVAILABLE: Galvanik-Auftragsdaten konnten nicht geladen werden.";

describe("W2C-B2M5U V8 queue truth", () => {
  it("renders an unknown due state without inventing an in-plan claim", () => {
    const { container } = render(
      <OrderQueueRow
        order={{
          id: "1",
          orderNumber: "A-1",
          customerName: "Kunde",
          title: "Teil",
          detail: "Zink",
          station: "galvanik",
          dueLabel: "Termin nicht erfasst",
          risk: "unknown",
        }}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText("Termin nicht erfasst")).toBeInTheDocument();
    expect(screen.queryByText("IM PLAN")).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-risk="unknown"]'),
    ).toBeInTheDocument();
  });

  it.each([
    [
      "non-ok",
      () =>
        getGalvanikOrdersAction.mockResolvedValueOnce({
          ok: false,
          error: "QUERY_ERROR",
          message: unavailable,
        }),
    ],
    [
      "rejection",
      () => getGalvanikOrdersAction.mockRejectedValueOnce(new Error("offline")),
    ],
  ])("renders fail-closed for %s", async (_caseName, arrange) => {
    arrange();
    render(<GalvanikPage />);
    await waitFor(() =>
      expect(screen.getByText(unavailable)).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("Noch keine Daten erfasst."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Dringlich in Galvanik")).not.toBeInTheDocument();
  });

  it("renders the real empty state only after the read succeeds", async () => {
    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [] });
    render(<GalvanikPage />);
    expect(
      await screen.findByText("Noch keine Daten erfasst."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("0 Aufträge")).toHaveLength(2);
  });
});
