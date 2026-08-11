import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const getGalvanikOrdersAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/warendurchlauf/actions", () => ({ getGalvanikOrdersAction }));
vi.mock("@/components/orders/GalvanikHandoffAttachmentPanel", () => ({
  GalvanikHandoffAttachmentPanel: () => null,
}));
vi.mock("@/components/orders/OrderModalProvider", () => ({ useOrderModal: () => ({ openOrder: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("lucide-react", () => ({ ArrowRight: () => null, Layers: () => null, PlayCircle: () => null, CheckCircle2: () => null, AlertTriangle: () => null, Loader2: () => null, ChevronRight: () => null }));
import { OrderWideCard } from "@/components/orders/OrderWideCard";
import { OrderCompactCard } from "@/components/orders/OrderCompactCard";
import GalvanikPage from "@/app/warendurchlauf/galvanik/page";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const unavailable = "NOT_AVAILABLE: Galvanik-Auftragsdaten konnten nicht geladen werden.";

describe("W2C-B2M5U unknown order cards", () => {
  it("renders unknown cards in neutral slate styling, never green or IM PLAN", () => {
    const props = { id: "1", orderNumber: "A-1", customerName: "Kunde", article: "Teil", surface: "Zink", urgency: "unknown" as const, badgeText: "TERMIN NICHT ERFASST", dueLabel: "Termin", dueValue: "Nicht erfasst", onClick: vi.fn() };
    const { container } = render(<><OrderWideCard {...props} /><OrderCompactCard {...props} /></>);
    expect(screen.getAllByText("TERMIN NICHT ERFASST").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nicht erfasst").length).toBeGreaterThan(0);
    expect(container.querySelector(".u-unknown .card-bar")).toBeInTheDocument();
    expect(container.querySelector(".border-slate-300.bg-slate-50")).toBeInTheDocument();
    expect(screen.queryByText("IM PLAN")).not.toBeInTheDocument();
    expect(container.querySelector(".text-success-green")).not.toBeInTheDocument();
  });

  it.each([
    ["non-ok", () => { getGalvanikOrdersAction.mockResolvedValueOnce({ ok: false, message: unavailable }); }],
    ["rejection", () => { getGalvanikOrdersAction.mockRejectedValueOnce(new Error("offline")); }],
  ])("renders fail-closed for %s", async (_caseName, arrange) => {
    arrange();
    render(<GalvanikPage />);
    await waitFor(() => expect(screen.getByText(unavailable)).toBeInTheDocument());
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
    expect(screen.queryByText("0 Aufträge")).not.toBeInTheDocument();
    expect(screen.queryByText("Dringlich in Galvanik")).not.toBeInTheDocument();
  });

  it("keeps the initial deferred state free of empty success claims", () => {
    getGalvanikOrdersAction.mockReturnValueOnce(new Promise(() => {}));
    render(<GalvanikPage />);
    expect(screen.getByText("Lade Galvanik Aufträge...")).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
    expect(screen.queryByText("0 Aufträge")).not.toBeInTheDocument();
  });

  it("renders the real empty state only after the fixed action succeeds", async () => {
    getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [] });
    render(<GalvanikPage />);
    expect(await screen.findByText("Noch keine Daten erfasst.")).toBeInTheDocument();
    expect(screen.getAllByText("0 Aufträge").length).toBe(3);
  });
});
