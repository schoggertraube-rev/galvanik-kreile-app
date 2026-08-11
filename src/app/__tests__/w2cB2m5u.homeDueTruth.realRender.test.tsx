import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getOrdersDb = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/orders.actions", () => ({ getOrdersDb }));
vi.mock("@/hooks/usePageView", () => ({ usePageView: vi.fn() }));
vi.mock("@/hooks/useHydrated", () => ({ useHydrated: () => true }));
vi.mock("@/lib/auth/PermissionsContext", () => ({ usePermissions: () => ({ name: "Test" }) }));
vi.mock("@/lib/offline/SyncContext", () => ({ useSync: () => ({ isOnline: true, outboxItems: [], syncNow: vi.fn() }) }));
vi.mock("@/components/ui/AppShortcutContext", () => ({ useAppShortcut: () => ({ openShortcut: vi.fn() }) }));
vi.mock("@/components/orders/OrderModalProvider", () => ({ useOrderModal: () => ({ openOrder: vi.fn() }) }));
vi.mock("@/components/erfassung/ErfassungProvider", () => ({ useErfassung: () => ({ openErfassung: vi.fn() }) }));
vi.mock("@/components/ui/DetailOverlay", () => ({ DetailOverlay: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("lucide-react", () => ({ UserPlus: () => null, FilePlus: () => null, Camera: () => null, AlertTriangle: () => null, CheckCircle: () => null, Activity: () => null, Info: () => null, Phone: () => null, RefreshCw: () => null, Sparkles: () => null, BarChart3: () => null }));
import HomeDashboard from "@/app/page";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const order = (dueDate: string, risk: "red" | "orange" | "unknown" = "red") => ({ id: dueDate, dueDate, risk, station: "galvanik" });

describe("W2C-B2M5U home due truth", () => {
  it("fails closed through loading, unavailable, empty, stored due and both failed refresh forms", async () => {
    let resolve!: (value: { ok: true; data: never[] }) => void;
    getOrdersDb.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = render(<HomeDashboard />);
    expect(screen.getAllByText("Auftragsdaten werden geladen...").length).toBeGreaterThan(0);
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
    expect(screen.queryByText("Keine kritischen Aufträge")).not.toBeInTheDocument();
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();

    await act(async () => resolve({ ok: true, data: [] }));
    expect(await screen.findByText("Noch keine Aufträge erfasst")).toBeInTheDocument();

    getOrdersDb.mockResolvedValueOnce({ ok: true, data: [order("2030-01-01", "red")] });
    await act(async () => window.dispatchEvent(new Event("kreile-orders-updated")));
    expect(await screen.findByText("Kritische Aufträge prüfen (1)")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();

    getOrdersDb.mockResolvedValueOnce({ ok: true, data: [order("", "unknown")] });
    await act(async () => window.dispatchEvent(new Event("kreile-orders-updated")));
    expect(await screen.findByText("Fälligkeit nicht verfügbar")).toBeInTheDocument();
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();

    getOrdersDb.mockResolvedValueOnce({ ok: false });
    await act(async () => window.dispatchEvent(new Event("kreile-orders-updated")));
    await waitFor(() => expect(screen.getAllByText("NOT_AVAILABLE: Auftragsdaten konnten nicht geladen werden.").length).toBeGreaterThan(0));
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
    expect(screen.queryByText("Kritische Aufträge prüfen (1)")).not.toBeInTheDocument();

    getOrdersDb.mockRejectedValueOnce(new Error("refresh offline"));
    await act(async () => window.dispatchEvent(new Event("kreile-orders-updated")));
    await waitFor(() => expect(screen.getAllByText("NOT_AVAILABLE: Auftragsdaten konnten nicht geladen werden.").length).toBeGreaterThan(0));
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
    expect(screen.queryByText("Kritische Aufträge prüfen (1)")).not.toBeInTheDocument();
    view.unmount();
  });
});
