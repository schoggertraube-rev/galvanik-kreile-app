import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stationDenial = "NOT_AVAILABLE: Stationsliste ist nicht verfügbar.";
const stationThrowDenial = "NOT_AVAILABLE: Stationsliste konnte nicht sicher geladen werden.";
const ports = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  getWareneingangOrdersAction: vi.fn(),
  getGalvanikOrdersAction: vi.fn(),
  getWarendurchlaufKPIs: vi.fn(),
  openErfassung: vi.fn(),
  openOrder: vi.fn(),
  pushRoute: vi.fn(),
  useSelectedLayoutSegment: vi.fn(),
}));

vi.mock("@/app/warendurchlauf/actions", () => ({
  getWareneingangOrdersAction: ports.getWareneingangOrdersAction,
  getGalvanikOrdersAction: ports.getGalvanikOrdersAction,
  getWarendurchlaufKPIs: ports.getWarendurchlaufKPIs,
}));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: ports.resolveAuthorization }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: ports.pushRoute }),
  useSearchParams: () => new URLSearchParams(),
  useSelectedLayoutSegment: ports.useSelectedLayoutSegment,
}));
vi.mock("@/components/erfassung/ErfassungProvider", () => ({
  useErfassung: () => ({ openErfassung: ports.openErfassung }),
}));
vi.mock("@/components/entities/order-legacy/OrderCompactCard", () => ({ OrderCompactCard: () => <div /> }));
vi.mock("@/components/entities/order-legacy/WareneingangHandoffButton", () => ({ WareneingangHandoffButton: () => <div /> }));
vi.mock("@/lib/order-support/getUrgency", () => ({ getUrgency: () => "ok" }));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: (selector?: (state: { openOrder: typeof ports.openOrder }) => unknown) =>
    selector ? selector({ openOrder: ports.openOrder }) : { openOrder: ports.openOrder },
}));
vi.mock("@/hooks/usePageView", () => ({ usePageView: vi.fn() }));
vi.mock("lucide-react", () => ({
  Camera: () => null,
  PenLine: () => null,
  Phone: () => null,
  MessageSquare: () => null,
  Clock: () => null,
  ChevronRight: () => null,
  Zap: () => null,
}));

const allowedAuthorization = (role: string = "werkstatt") => ({
  ok: true as const,
  data: {
    userId: "user-phillip",
    tenantId: KREILE_TENANT_SLUG,
    displayName: "Phillip",
    role,
    permissions: role === "werkstatt" || role === "readonly"
      ? ["perm_view_leitstand"]
      : ["perm_view_leitstand", "perm_data_orders"],
    active: true as const,
  },
});

const order = (id: string, orderNumber: string, title: string, station: string, risk: string = "green") => ({
  id,
  version: 1,
  orderNumber,
  customerId: `customer-${id}`,
  customerName: `Kunde ${id}`,
  title,
  task: null,
  itemDescription: `Artikel ${id}`,
  surfaceRequested: "Verzinken",
  station,
  status: station,
  statusText: station === "wareneingang" ? "Angenommen" : "Fertig gemeldet",
  risk,
  currentStationId: station,
  parts: [],
  intakeDate: "2026-08-30",
  dueDate: "2026-09-01",
  dueLabel: "Termin",
  dueValue: "01.09.2026",
  createdAt: "2026-08-30T08:00:00.000Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  ports.resolveAuthorization.mockResolvedValue(allowedAuthorization());
  ports.getWareneingangOrdersAction.mockResolvedValue({ ok: true, data: [] });
  ports.getGalvanikOrdersAction.mockResolvedValue({ ok: true, data: [] });
  ports.getWarendurchlaufKPIs.mockResolvedValue({ ok: true, data: { wipCount: 0, dueThisWeekCount: 0 } });
  ports.useSelectedLayoutSegment.mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("W2C-B2M5J unavailable UI", () => {
  it("renders only the truthful station-loading status while the initial station read is pending", async () => {
    let resolveStationOrders!: (value: { ok: true; data: [] }) => void;
    const deferredStationOrders = new Promise<{ ok: true; data: [] }>((resolvePromise) => {
      resolveStationOrders = resolvePromise;
    });
    ports.getWareneingangOrdersAction.mockReturnValueOnce(deferredStationOrders);
    const { default: WareneingangPage } = await import("../wareneingang/page");
    const view = render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByText("Stationsliste wird geladen.", { exact: true })).toBeInTheDocument());
    expect(screen.getByText("Stationsliste wird geladen.", { exact: true }).closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();

    view.unmount();
    resolveStationOrders({ ok: true, data: [] });
  });

  it("renders authorized real werkstatt data with real risk-derived Heute-sichern cards and opens only the existing order", async () => {
    const wareneingang = order("we-1", "WE-001", "Wareneingang Sentinel", "wareneingang", "orange");
    const galvanik = order("ga-1", "GA-001", "Galvanik Sentinel", "fertig", "yellow");
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({ ok: true, data: [wareneingang] });
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [galvanik] });
    ports.getWarendurchlaufKPIs.mockResolvedValueOnce({ ok: true, data: { wipCount: 1, dueThisWeekCount: 2 } });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    expect(screen.getByRole("heading", { level: 1, name: "Werkstatt" })).toBeInTheDocument();
    const status = screen.getByTestId("werkstatt-status");
    expect(status).toHaveTextContent("Servus Phillip.");
    expect(status).toHaveTextContent("1 dringend");
    expect(status).toHaveTextContent("1 weitere");
    expect(screen.getByRole("navigation", { name: "Werkstattaktionen" })).toBeInTheDocument();

    const held = screen.getByTestId("werkstatt-held-list");
    expect(within(held).getByText("Wareneingang Sentinel")).toBeInTheDocument();
    expect(within(held).getByText("Galvanik Sentinel")).toBeInTheDocument();
    expect(screen.getByTestId("werkstatt-held-we-1")).toBeInTheDocument();
    expect(screen.getByTestId("werkstatt-held-ga-1")).toBeInTheDocument();
    const wipTile = screen.getByRole("button", { name: /In Arbeit \(Galvanik\)/ });
    expect(wipTile).toHaveTextContent("1");
    fireEvent.click(wipTile);
    expect(ports.pushRoute).toHaveBeenCalledTimes(1);
    expect(ports.pushRoute).toHaveBeenCalledWith("/warendurchlauf/galvanik");

    const wareneingangOrder = screen.getByRole("button", { name: /Auftrag WE-001/ });
    const galvanikOrder = screen.getByRole("button", { name: /Auftrag GA-001/ });
    expect(wareneingangOrder.className).toMatch(/touchTarget/);
    expect(galvanikOrder.className).toMatch(/touchTarget/);

    fireEvent.click(galvanikOrder);
    fireEvent.click(wareneingangOrder);
    expect(ports.openOrder).toHaveBeenNthCalledWith(1, "ga-1");
    expect(ports.openOrder).toHaveBeenNthCalledWith(2, "we-1");

    expect(screen.queryByRole("button", { name: "Neuer Eingang" })).not.toBeInTheDocument();
    expect(ports.openErfassung).not.toHaveBeenCalled();

    expect(ports.resolveAuthorization.mock.invocationCallOrder[0]).toBeLessThan(
      ports.getWareneingangOrdersAction.mock.invocationCallOrder[0],
    );
    expect(ports.resolveAuthorization.mock.invocationCallOrder[0]).toBeLessThan(
      ports.getGalvanikOrdersAction.mock.invocationCallOrder[0],
    );
    expect(screen.queryByText(/Demo|Mock|Station öffnen|In Galvanik starten|Als Nächstes/i)).not.toBeInTheDocument();
  });

  it("suggests a bundle only when surfaceRequested repeats and treats it as a filter, never a mutation", async () => {
    const shared = "Verzinken";
    const wareneingang = order("we-b1", "WE-B1", "Bündel Wareneingang", "wareneingang", "orange");
    const galvanik = order("ga-b1", "GA-B1", "Bündel Galvanik", "fertig", "orange");
    galvanik.surfaceRequested = shared;
    wareneingang.surfaceRequested = shared;
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({ ok: true, data: [wareneingang] });
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [galvanik] });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    const bundle = screen.getByTestId("werkstatt-bundle");
    expect(bundle).toHaveTextContent("2 Aufträge mit");
    expect(bundle).toHaveTextContent(shared);
    const filterButton = within(bundle).getByRole("button", { name: "Nur diese Aufträge zeigen" });
    expect(filterButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(filterButton);
    expect(filterButton).toHaveAttribute("aria-pressed", "true");
    const heldList = screen.getByTestId("werkstatt-held-list");
    expect(within(heldList).getAllByRole("listitem")).toHaveLength(2);
    expect(ports.openOrder).not.toHaveBeenCalled();
  });

  it("opens the real-order picker in Galvanik-first order and selects the exact existing order id", async () => {
    const wareneingang = order("we-picker", "WE-PICKER", "Wareneingang Picker Sentinel", "wareneingang");
    const galvanik = order("ga-picker", "GA-PICKER", "Galvanik Picker Sentinel", "fertig");
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({ ok: true, data: [wareneingang] });
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [galvanik] });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    const trigger = screen.getByRole("button", { name: "Auftrag öffnen / scannen" });
    expect(screen.queryByRole("dialog", { name: "Auftrag öffnen" })).not.toBeInTheDocument();

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Auftrag öffnen" });
    const pickerRows = within(dialog).getAllByTestId(/^order-picker-order-/);
    expect(pickerRows.map((row) => row.getAttribute("data-testid"))).toEqual([
      "order-picker-order-ga-picker",
      "order-picker-order-we-picker",
    ]);
    expect(within(dialog).getAllByText("GA-PICKER", { exact: true })).toHaveLength(1);
    expect(within(dialog).getAllByText("WE-PICKER", { exact: true })).toHaveLength(1);

    fireEvent.click(within(dialog).getByTestId("order-picker-order-ga-picker"));

    expect(ports.openOrder).toHaveBeenCalledTimes(1);
    expect(ports.openOrder).toHaveBeenCalledWith("ga-picker");
    expect(screen.queryByRole("dialog", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
  });

  it("also opens the same real-order picker from Mehrarbeit and Fertig melden, never faking a mutation", async () => {
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({
      ok: true,
      data: [order("we-x", "WE-X", "Wareneingang X", "wareneingang")],
    });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    fireEvent.click(screen.getByRole("button", { name: "Mehrarbeit" }));
    expect(screen.getByRole("dialog", { name: "Auftrag öffnen" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fertig melden" }));
    expect(screen.getByRole("dialog", { name: "Auftrag öffnen" })).toBeInTheDocument();
    expect(ports.openOrder).not.toHaveBeenCalled();
  });

  it("uses the existing fail-closed scan capture path from within the unchanged order picker", async () => {
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({
      ok: true,
      data: [order("we-scan", "WE-SCAN", "Scan Sentinel", "wareneingang")],
    });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    fireEvent.click(screen.getByRole("button", { name: "Auftrag öffnen / scannen" }));
    fireEvent.click(screen.getByRole("button", { name: "Auftrag scannen" }));
    expect(ports.openErfassung).toHaveBeenCalledWith({ mode: "scan" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens Ware raus with only canonical fertig candidates and selects through the injected app port", async () => {
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({
      ok: true,
      data: [order("we-out", "WE-OUT", "Wareneingang Ausgang Sentinel", "wareneingang")],
    });
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({
      ok: true,
      data: [
        order("ga-out", "GA-OUT", "Galvanik Ausgang Sentinel", "galvanik"),
        order("fi-out", "FI-OUT", "Fertiger Ausgang Sentinel", "fertig"),
      ],
    });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    const trigger = screen.getByRole("button", { name: "Ware raus" });
    expect(trigger).toBeEnabled();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Ware raus" });
    expect(within(dialog).getByTestId("goods-out-picker-order-fi-out")).toBeVisible();
    expect(within(dialog).queryByText("WE-OUT", { exact: true })).not.toBeInTheDocument();
    expect(within(dialog).queryByText("GA-OUT", { exact: true })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Auftrag scannen" })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByTestId("goods-out-picker-order-fi-out"));

    expect(ports.openOrder).toHaveBeenCalledTimes(1);
    expect(ports.openOrder).toHaveBeenCalledWith("fi-out");
    expect(screen.queryByRole("dialog", { name: "Ware raus" })).not.toBeInTheDocument();
  });

  it("shows an honest Ware-raus empty picker when real data contains no fertig order", async () => {
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({
      ok: true,
      data: [order("ga-no-out", "GA-NO-OUT", "Noch in Galvanik", "galvanik")],
    });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    fireEvent.click(screen.getByRole("button", { name: "Ware raus" }));

    const dialog = screen.getByRole("dialog", { name: "Ware raus" });
    expect(within(dialog).getByTestId("goods-out-picker-empty")).toHaveTextContent(
      "Keine fertig gemeldete Ware zur Ausgabe vorhanden.",
    );
    expect(within(dialog).queryAllByTestId(/^goods-out-picker-order-/)).toHaveLength(0);
    expect(ports.openOrder).not.toHaveBeenCalled();
  });

  it("traps Tab focus, closes the real-order picker explicitly or with Escape, and returns focus", async () => {
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({
      ok: true,
      data: [order("we-focus-last", "WE-FOCUS", "Letzter Fokus Sentinel", "wareneingang")],
    });
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({
      ok: true,
      data: [order("ga-focus", "GA-FOCUS", "Fokus Sentinel", "fertig")],
    });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    const trigger = screen.getByRole("button", { name: "Auftrag öffnen / scannen" });
    trigger.focus();
    fireEvent.click(trigger);
    const closeButton = screen.getByRole("button", { name: "Schließen" });
    await waitFor(() => expect(closeButton).toHaveFocus());
    const dialog = screen.getByRole("dialog", { name: "Auftrag öffnen" });
    const lastPickerOrder = within(dialog).getByTestId("order-picker-order-we-focus-last");

    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(lastPickerOrder).toHaveFocus();
    fireEvent.keyDown(lastPickerOrder, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.click(closeButton);
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Auftrag öffnen" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Auftrag öffnen" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(ports.openOrder).not.toHaveBeenCalled();
  });

  it("offers the existing intake path only when the authorized role has the order-write permission", async () => {
    ports.resolveAuthorization.mockResolvedValueOnce(allowedAuthorization("buero"));
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    const intakeButton = screen.getByRole("button", { name: "Neuer Eingang" });
    fireEvent.click(intakeButton);
    expect(ports.openErfassung).toHaveBeenCalledWith({
      mode: "order",
      intent: "create_order",
      source: "shortcut",
      returnTo: "/warendurchlauf",
    });
  });

  it("renders a truthful root empty state only after both station ports succeed empty", async () => {
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    expect(screen.getByRole("heading", { name: "Noch keine Daten erfasst" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auftrag öffnen / scannen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Neuer Eingang" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Werkstattaktionen" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ware raus" }));
    expect(screen.getByRole("dialog", { name: "Ware raus" })).toHaveTextContent(
      "Keine fertig gemeldete Ware zur Ausgabe vorhanden.",
    );
  });

  it("lets readonly inspect the real empty workshop but exposes no mutation action", async () => {
    ports.resolveAuthorization.mockResolvedValueOnce(allowedAuthorization("readonly"));
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    expect(screen.getByRole("heading", { name: "Noch keine Daten erfasst" })).toBeInTheDocument();
    expect(ports.getWareneingangOrdersAction).toHaveBeenCalledTimes(1);
    expect(ports.getGalvanikOrdersAction).toHaveBeenCalledTimes(1);
    expect(ports.getWarendurchlaufKPIs).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Auftrag öffnen / scannen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Neuer Eingang" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Werkstattaktionen" })).not.toBeInTheDocument();
  });

  it("suppresses a successful Wareneingang payload when Galvanik denies the atomic root read", async () => {
    const sentinel = order("we-secret", "WE-SECRET", "Wareneingang Teilresultat Sentinel", "wareneingang");
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({ ok: true, data: [sentinel] });
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({ ok: false, error: "FORBIDDEN", message: "forbidden" });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    expect(screen.getByText("Zugriff nicht erlaubt.")).toBeInTheDocument();
    expect(screen.queryByText("Wareneingang Teilresultat Sentinel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("werkstatt-held-we-secret")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auftrag öffnen / scannen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
  });

  it("suppresses a successful Galvanik payload when Wareneingang fails the atomic root read", async () => {
    const sentinel = order("ga-secret", "GA-SECRET", "Galvanik Teilresultat Sentinel", "fertig");
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({ ok: false, error: "QUERY_ERROR", message: "query" });
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [sentinel] });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    expect(screen.getByText("Werkstattdaten konnten nicht sicher geladen werden.")).toBeInTheDocument();
    expect(screen.queryByText("Galvanik Teilresultat Sentinel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("werkstatt-held-ga-secret")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auftrag öffnen / scannen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Werkstattaktionen" })).not.toBeInTheDocument();
  });

  it("suppresses both station payloads when the canonical KPI read fails closed", async () => {
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({
      ok: true,
      data: [order("we-kpi", "WE-KPI", "Wareneingang KPI Sentinel", "wareneingang")],
    });
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({
      ok: true,
      data: [order("ga-kpi", "GA-KPI", "Galvanik KPI Sentinel", "galvanik")],
    });
    ports.getWarendurchlaufKPIs.mockResolvedValueOnce({ ok: false, error: "QUERY_ERROR", message: "query" });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    expect(screen.getByText("Werkstattdaten konnten nicht sicher geladen werden.")).toBeInTheDocument();
    expect(screen.queryByText(/KPI Sentinel/)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Werkstattaktionen" })).not.toBeInTheDocument();
  });

  it.each([
    [
      "id",
      order("duplicate-id", "WE-DUP-ID", "Duplicate ID Wareneingang Sentinel", "wareneingang"),
      order("duplicate-id", "GA-DUP-ID", "Duplicate ID Galvanik Sentinel", "galvanik"),
    ],
    [
      "orderNumber",
      order("we-duplicate-number", "DUP-NUMBER", "Duplicate Number Wareneingang Sentinel", "wareneingang"),
      order("ga-duplicate-number", "DUP-NUMBER", "Duplicate Number Galvanik Sentinel", "galvanik"),
    ],
  ])("renders a data-free conflict for a duplicate canonical %s", async (_field, wareneingang, galvanik) => {
    ports.resolveAuthorization.mockResolvedValueOnce(allowedAuthorization("buero"));
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({ ok: true, data: [wareneingang] });
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [galvanik] });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    expect(screen.getByRole("alert")).toHaveTextContent("Werkstattkonflikt");
    expect(screen.getByText("Werkstattdaten enthalten widersprüchliche Auftragskennungen.")).toBeVisible();
    expect(screen.queryByText(wareneingang.title)).not.toBeInTheDocument();
    expect(screen.queryByText(galvanik.title)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`werkstatt-held-${wareneingang.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`werkstatt-held-${galvanik.id}`)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Neuer Eingang" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auftrag öffnen / scannen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Werkstattaktionen" })).not.toBeInTheDocument();
    expect(ports.openErfassung).not.toHaveBeenCalled();
    expect(ports.openOrder).not.toHaveBeenCalled();
  });

  it("renders an honest loading state without fake operational data", async () => {
    const { default: Loading } = await import("../loading");
    render(<Loading />);

    expect(screen.getByRole("status")).toHaveTextContent("Werkstattdaten werden geladen.");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByLabelText("Werkstatt", { selector: "section" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("heading", { level: 1, name: "Werkstatt" })).toBeInTheDocument();
    expect(screen.queryByText(/WE-001|GA-001|Noch keine Daten erfasst/)).not.toBeInTheDocument();
  });

  it("source-locks the responsive Heute-sichern hierarchy, touch targets, and reduced-motion contract", () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), "src/modules/werkstatt/ui/WerkstattView.tsx"),
      "utf8",
    );
    const cssSource = readFileSync(
      resolve(process.cwd(), "src/modules/werkstatt/ui/WerkstattView.module.css"),
      "utf8",
    );
    const adapterSource = readFileSync(
      resolve(process.cwd(), "src/app/warendurchlauf/WerkstattAppAdapter.tsx"),
      "utf8",
    );
    const routeSource = readFileSync(resolve(process.cwd(), "src/app/warendurchlauf/page.tsx"), "utf8");
    const typesSource = readFileSync(
      resolve(process.cwd(), "src/modules/werkstatt/server/types.ts"),
      "utf8",
    );
    const manifestSource = readFileSync(
      resolve(process.cwd(), "src/modules/werkstatt/werkstatt.manifest.json"),
      "utf8",
    );

    expect(clientSource).toContain('data-testid="werkstatt-held-list"');
    expect(clientSource).toContain("Auftrag öffnen / scannen");
    expect(clientSource).toContain('aria-controls={PICKER_DIALOG_ID}');
    expect(clientSource).toContain('activePicker === "goods-out"');
    expect(clientSource).toContain("view.goodsOutCandidates");
    expect(clientSource).toContain('className={`${styles.actionPrimary} ${styles.touchTarget}`}');
    expect(clientSource).toContain('className={`${styles.heldOpenButton} ${styles.touchTarget}`}');
    expect(cssSource).toMatch(/\.touchTarget\s*\{[^}]*min-height:\s*48px;/);
    expect(cssSource).toMatch(/\.pickerClose\s*\{[^}]*min-height:\s*48px;/);
    expect(cssSource).toMatch(/\.pickerBackdrop\s*\{[^}]*overflow-x:\s*hidden;/);
    expect(cssSource).toMatch(
      /\.wipTile\s*\{[^}]*display:\s*block;[^}]*width:\s*100%;[^}]*appearance:\s*none;[^}]*border:\s*0;[^}]*font:\s*inherit;[^}]*text-align:\s*left;[^}]*cursor:\s*pointer;/,
    );
    expect(cssSource).toMatch(
      /\.screen\s*\{[^}]*box-sizing:\s*border-box;[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*overflow:\s*hidden;[^}]*padding:\s*20px 16px 0;/,
    );
    expect(cssSource).toMatch(
      /\.inner\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*1220px;[^}]*min-width:\s*0;[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*flex:\s*1 1 auto;[^}]*overflow:\s*hidden;/,
    );
    expect(cssSource).toMatch(
      /\.cols\s*\{[^}]*min-width:\s*0;[^}]*min-height:\s*0;[^}]*flex:\s*1 1 auto;[^}]*overflow-y:\s*auto;[^}]*overflow-x:\s*hidden;/,
    );
    expect(cssSource).toMatch(
      /\.actionBar\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*0;[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*flex:\s*0 0 auto;[^}]*margin-top:\s*auto;[^}]*overflow-x:\s*clip;/,
    );
    expect(cssSource).not.toMatch(/\.actionBar\s*\{[^}]*position:\s*(?:relative|absolute|fixed);/);
    expect(cssSource).toMatch(/@media \(min-width: 64rem\)[\s\S]*grid-template-columns:\s*minmax\(0, 1\.6fr\) minmax\(18rem, 0\.9fr\)/);
    expect(cssSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cssSource).toContain("overflow-x: clip");
    expect(typesSource).not.toContain("OperationalOrder");
    expect(typesSource).toContain("export type WerkstattViewPorts");
    expect(typesSource).toContain("onOpenWip: () => void;");
    expect(typesSource).toContain("onOpenGoodsOut: (orderId: string) => void;");
    expect(clientSource).not.toMatch(/@\/components\/|@\/hooks\/|@\/lib\/overlayStore/);
    expect(clientSource).toContain("onClick={ports.onOpenWip}");
    expect(clientSource).not.toMatch(/next\/link|next\/navigation|\/warendurchlauf\//);
    expect(adapterSource).toContain('from "@/components/erfassung/ErfassungProvider"');
    expect(adapterSource).toContain('from "@/hooks/usePageView"');
    expect(adapterSource).toContain('from "@/lib/overlayStore"');
    expect(adapterSource).toContain('from "next/navigation"');
    expect(adapterSource).toContain('onOpenWip: () => router.push("/warendurchlauf/galvanik")');
    expect(adapterSource).toContain("onOpenGoodsOut: openOrder");
    expect(routeSource).toContain('from "@/components/home/WerkstattHome"');
    expect(routeSource).toContain("WerkstattHome({ authorization: authorization.data })");
    expect(manifestSource).toContain("@/modules/werkstatt/public#WerkstattViewPorts");
    expect(manifestSource).toContain('"dependencies": []');
    expect(clientSource).not.toMatch(/Demo|Mock|Station öffnen|In Galvanik starten|Als Nächstes|ThemeToggle/);
  });

  it("renders station denial without confirmed empty-station success while KPI tiles remain unavailable", async () => {
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({ ok: false, error: "NOT_AVAILABLE", message: stationDenial } as never);
    const { default: WareneingangPage } = await import("../wareneingang/page");
    render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByText(stationDenial)).toBeInTheDocument());
    expect(screen.getByText(stationDenial).closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
    expect(screen.queryByText("Termintreue Durchlaufzeit Engpass Offene Aufträge")).not.toBeInTheDocument();
    expect(ports.getWareneingangOrdersAction).toHaveBeenCalledWith();
  });

  it("renders the stable station denial when the station read throws", async () => {
    ports.getWareneingangOrdersAction.mockRejectedValueOnce(new Error("network failure"));
    const { default: WareneingangPage } = await import("../wareneingang/page");
    render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByText(stationThrowDenial)).toBeInTheDocument());
    expect(screen.getByText(stationThrowDenial).closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
  });

  it("keeps a successful empty station list free of any derived KPI display", async () => {
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({ ok: true, data: [] });
    const { default: WareneingangPage } = await import("../wareneingang/page");
    render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByText("Noch keine Daten erfasst.")).toBeInTheDocument());
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("Termintreue Durchlaufzeit Engpass Offene Aufträge")).not.toBeInTheDocument();
    expect(screen.queryByText(/Tagesstand|Checkliste Heute|Überfällig|Diese Woche|Im Plan/)).not.toBeInTheDocument();
  });

  it("source-locks the truthful station states without any KPI-derived display", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/warendurchlauf/wareneingang/page.tsx"), "utf8");
    expect(source).not.toContain("getWarendurchlaufKPIs");
    expect(source).not.toContain("kpiUnavailableMessage");
    expect(source).toContain("const [stationUnavailableMessage, setStationUnavailableMessage]");
    expect(source).toContain("const [stationListPending, setStationListPending] = useState(true);");
    expect(source).toContain("setStationListPending(true);");
    expect(source).toContain("setStationListPending(false);");
    expect(source).toContain("{stationListPending ? (");
    expect(source).toContain("Stationsliste wird geladen.");
    expect(source).toContain("setStationUnavailableMessage(resList.message)");
    expect(source).toContain("NOT_AVAILABLE: Stationsliste konnte nicht sicher geladen werden.");
    expect(source).toContain("getWareneingangOrdersAction()");
    expect(source).not.toContain("getStationOrders(\"wareneingang\")");
    expect(source).not.toContain("} catch {} ");
  });
});
