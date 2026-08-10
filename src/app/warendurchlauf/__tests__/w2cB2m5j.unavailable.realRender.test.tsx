import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const denial = "NOT_AVAILABLE: Warendurchlauf-KPIs benötigen einen kanonischen SQL-Read-Model-Vertrag.";
const stationDenial = "NOT_AVAILABLE: Stationsliste ist nicht verfügbar.";
const stationThrowDenial = "NOT_AVAILABLE: Stationsliste konnte nicht sicher geladen werden.";
const getWarendurchlaufKPIs = vi.fn(async () => ({ ok: false as const, error: "NOT_AVAILABLE" as const, message: denial }));
const getStationOrders = vi.fn(async () => ({ ok: true as const, data: [] }));

vi.mock("@/app/warendurchlauf/actions", () => ({ getWarendurchlaufKPIs, getStationOrders }));
vi.mock("../WarendurchlaufCockpitClient", () => ({ WarendurchlaufCockpitClient: () => <div>Termintreue Durchlaufzeit Engpass Offene Aufträge</div> }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/erfassung/ErfassungProvider", () => ({ useErfassung: () => ({ openErfassung: vi.fn() }) }));
vi.mock("@/components/orders/OrderCompactCard", () => ({ OrderCompactCard: () => <div /> }));
vi.mock("@/lib/orders/getUrgency", () => ({ getUrgency: () => "ok" }));
vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: () => ({ openOrder: vi.fn() }) }));
vi.mock("lucide-react", () => ({
  Camera: () => null,
  PenLine: () => null,
  Phone: () => null,
  MessageSquare: () => null,
  Clock: () => null,
  ChevronRight: () => null,
  Zap: () => null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("W2C-B2M5J unavailable UI", () => {
  it("renders only the truthful station-loading status while the initial station read is pending", async () => {
    let resolveStationOrders!: (value: { ok: true; data: [] }) => void;
    const deferredStationOrders = new Promise<{ ok: true; data: [] }>((resolve) => {
      resolveStationOrders = resolve;
    });
    getStationOrders.mockReturnValueOnce(deferredStationOrders);
    const { default: WareneingangPage } = await import("../wareneingang/page");
    const view = render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByText("Stationsliste wird geladen.", { exact: true })).toBeInTheDocument());
    expect(screen.getByText("Stationsliste wird geladen.", { exact: true }).closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Aktuell keine Aufträge in dieser Station.")).not.toBeInTheDocument();

    view.unmount();
    resolveStationOrders({ ok: true, data: [] });
  });

  it("renders the root denial instead of false-zero KPI tiles", async () => {
    const { default: WarendurchlaufIndex } = await import("../page");
    const html = renderToStaticMarkup(await WarendurchlaufIndex());

    expect(html).toContain(denial);
    for (const tile in { Termintreue: 0, Durchlaufzeit: 0, Engpass: 0, "Offene Aufträge": 0 }) expect(html).not.toContain(tile);
  });

  it("renders station denial without confirmed empty-station success while KPI tiles remain unavailable", async () => {
    getStationOrders.mockResolvedValueOnce({ ok: false, error: "NOT_AVAILABLE", message: stationDenial } as never);
    const { default: WareneingangPage } = await import("../wareneingang/page");
    render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByText(stationDenial)).toBeInTheDocument());
    expect(screen.getByText(stationDenial).closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("Aktuell keine Aufträge in dieser Station.")).not.toBeInTheDocument();
    expect(screen.queryByText("Termintreue Durchlaufzeit Engpass Offene Aufträge")).not.toBeInTheDocument();
    expect(getStationOrders).toHaveBeenCalledWith("wareneingang");
  });

  it("renders the stable station denial when the station read throws", async () => {
    getStationOrders.mockRejectedValueOnce(new Error("network failure"));
    const { default: WareneingangPage } = await import("../wareneingang/page");
    render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByText(stationThrowDenial)).toBeInTheDocument());
    expect(screen.getByText(stationThrowDenial).closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("Aktuell keine Aufträge in dieser Station.")).not.toBeInTheDocument();
  });

  it("keeps a successful empty station list distinct from KPI denial", async () => {
    getStationOrders.mockResolvedValueOnce({ ok: true, data: [] });
    const { default: WareneingangPage } = await import("../wareneingang/page");
    render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByText("Aktuell keine Aufträge in dieser Station.")).toBeInTheDocument());
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText(denial).closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText("Termintreue Durchlaufzeit Engpass Offene Aufträge")).not.toBeInTheDocument();
  });

  it("source-locks explicit KPI-unavailable handling without treating the station list as KPI success", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/warendurchlauf/wareneingang/page.tsx"), "utf8");
    expect(source).toContain("const [kpiUnavailableMessage, setKpiUnavailableMessage]");
    expect(source).toContain("setKpiUnavailableMessage(resKPI.message)");
    expect(source).toContain("{kpiUnavailableMessage ? (");
    expect(source).toContain("const [stationUnavailableMessage, setStationUnavailableMessage]");
    expect(source).toContain("const [stationListPending, setStationListPending] = useState(true);");
    expect(source).toContain("setStationListPending(true);");
    expect(source).toContain("setStationListPending(false);");
    expect(source).toContain("{stationListPending ? (");
    expect(source).toContain("Stationsliste wird geladen.");
    expect(source).toContain("setStationUnavailableMessage(resList.message)");
    expect(source).toContain("NOT_AVAILABLE: Stationsliste konnte nicht sicher geladen werden.");
    expect(source).not.toContain("} catch {} ");
  });
});
