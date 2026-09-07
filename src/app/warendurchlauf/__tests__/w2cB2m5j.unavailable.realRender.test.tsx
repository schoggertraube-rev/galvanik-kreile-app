import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import React from "react";
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
  openErfassung: vi.fn(),
  openOrder: vi.fn(),
  useSelectedLayoutSegment: vi.fn(),
}));

vi.mock("@/app/warendurchlauf/actions", () => ({
  getWareneingangOrdersAction: ports.getWareneingangOrdersAction,
  getGalvanikOrdersAction: ports.getGalvanikOrdersAction,
}));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: ports.resolveAuthorization }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useSelectedLayoutSegment: ports.useSelectedLayoutSegment,
}));
vi.mock("@/components/erfassung/ErfassungProvider", () => ({
  useErfassung: () => ({ openErfassung: ports.openErfassung }),
}));
vi.mock("@/components/orders/OrderCompactCard", () => ({ OrderCompactCard: () => <div /> }));
vi.mock("@/components/orders/WareneingangHandoffButton", () => ({ WareneingangHandoffButton: () => <div /> }));
vi.mock("@/lib/orders/getUrgency", () => ({ getUrgency: () => "ok" }));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: (selector?: (state: { openOrder: typeof ports.openOrder }) => unknown) =>
    selector ? selector({ openOrder: ports.openOrder }) : { openOrder: ports.openOrder },
}));
vi.mock("@/hooks/usePageView", () => ({ usePageView: vi.fn() }));
vi.mock("@/components/warendurchlauf/WarendurchlaufStationNav", () => ({
  WarendurchlaufStationNav: () => <nav>Legacy-Station-Navigation</nav>,
}));
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
    permissions: role === "werkstatt"
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

  it("renders authorized real station data and opens only the existing order and intake paths", async () => {
    const wareneingang = order("we-1", "WE-001", "Wareneingang Sentinel", "wareneingang", "red");
    const galvanik = order("ga-1", "GA-001", "Galvanik Sentinel", "fertig");
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({ ok: true, data: [wareneingang] });
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [galvanik] });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    expect(screen.getByRole("heading", { level: 1, name: "Werkstatt" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wareneingang" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Galvanik / fertig gemeldet" })).toBeInTheDocument();
    const workbench = screen.getByTestId("phillip-workbench");
    const galvanikSurface = screen.getByTestId("werkstatt-surface-galvanik");
    const wareneingangSurface = screen.getByTestId("werkstatt-surface-wareneingang");
    expect(workbench.className).toMatch(/workbench/);
    expect(workbench.children[0]).toBe(galvanikSurface);
    expect(workbench.children[1]).toBe(wareneingangSurface);
    expect(galvanikSurface).toHaveAttribute("data-priority", "main");
    expect(galvanikSurface.className).toMatch(/primaryPanel/);
    expect(wareneingangSurface).toHaveAttribute("data-priority", "supporting");
    expect(wareneingangSurface.className).toMatch(/supportingPanel/);
    expect(screen.getByTestId("werkstatt-surface-wareneingang")).toHaveTextContent("Annahme");
    expect(screen.getByTestId("werkstatt-surface-galvanik")).toHaveTextContent("Ein Galvanik-Schritt");
    expect(screen.getByText("Wareneingang Sentinel")).toBeInTheDocument();
    expect(screen.getByText("Galvanik Sentinel")).toBeInTheDocument();
    expect(screen.getByText("Angenommen").className).toMatch(/statusDanger/);

    const wareneingangOrder = screen.getByRole("button", { name: /Auftrag WE-001/ });
    const galvanikOrder = screen.getByRole("button", { name: /Auftrag GA-001/ });
    expect(wareneingangOrder.className).toMatch(/touchTarget/);
    expect(galvanikOrder.className).toMatch(/touchTarget/);
    expect(screen.getByRole("link", { name: "Wareneingang öffnen" }).className).toMatch(/touchTarget/);
    const galvanikLink = screen.getByRole("link", { name: "Galvanik öffnen" });
    expect(galvanikLink).toHaveAttribute("href", "/warendurchlauf/galvanik");
    expect(galvanikLink.className).toMatch(/secondaryAction/);
    expect(galvanikLink.className).toMatch(/touchTarget/);

    fireEvent.click(wareneingangOrder);
    fireEvent.click(galvanikOrder);
    expect(ports.openOrder).toHaveBeenNthCalledWith(1, "we-1");
    expect(ports.openOrder).toHaveBeenNthCalledWith(2, "ga-1");

    expect(screen.queryByRole("button", { name: "Neuer Eingang" })).not.toBeInTheDocument();
    expect(ports.openErfassung).not.toHaveBeenCalled();

    expect(ports.resolveAuthorization.mock.invocationCallOrder[0]).toBeLessThan(
      ports.getWareneingangOrdersAction.mock.invocationCallOrder[0],
    );
    expect(ports.resolveAuthorization.mock.invocationCallOrder[0]).toBeLessThan(
      ports.getGalvanikOrdersAction.mock.invocationCallOrder[0],
    );
    expect(screen.queryByText(/Demo|Mock|Bündel|Zink-Lauf|Ware raus|Heute sichern|kommt/i)).not.toBeInTheDocument();
  });

  it("opens the real-order picker in Galvanik-first order and selects the exact existing order id", async () => {
    const wareneingang = order("we-picker", "WE-PICKER", "Wareneingang Picker Sentinel", "wareneingang");
    const galvanik = order("ga-picker", "GA-PICKER", "Galvanik Picker Sentinel", "fertig");
    ports.getWareneingangOrdersAction.mockResolvedValueOnce({ ok: true, data: [wareneingang] });
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [galvanik] });
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    const trigger = screen.getByRole("button", { name: "Auftrag öffnen" });
    expect(trigger.className).toMatch(/primaryAction/);
    expect(trigger.className).toMatch(/touchTarget/);
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

    const trigger = screen.getByRole("button", { name: "Auftrag öffnen" });
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
    expect(intakeButton.className).toMatch(/secondaryAction/);
    expect(intakeButton.className).toMatch(/touchTarget/);
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

    expect(screen.getAllByText("Noch keine Daten erfasst.")).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Neuer Eingang" })).not.toBeInTheDocument();
  });

  it("denies an excluded root role before either station action is invoked", async () => {
    ports.resolveAuthorization.mockResolvedValueOnce(allowedAuthorization("developer"));
    const { default: WarendurchlaufIndex } = await import("../page");
    render(await WarendurchlaufIndex());

    expect(screen.getByText("Zugriff nicht erlaubt.")).toBeInTheDocument();
    expect(ports.getWareneingangOrdersAction).not.toHaveBeenCalled();
    expect(ports.getGalvanikOrdersAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
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
    expect(screen.queryByTestId("werkstatt-order-we-secret")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
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
    expect(screen.queryByTestId("werkstatt-order-ga-secret")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
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
    expect(screen.queryByTestId(`werkstatt-order-${wareneingang.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`werkstatt-order-${galvanik.id}`)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Neuer Eingang" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Auftrag öffnen" })).not.toBeInTheDocument();
    expect(ports.openErfassung).not.toHaveBeenCalled();
    expect(ports.openOrder).not.toHaveBeenCalled();
  });

  it("renders an honest loading state without fake operational data", async () => {
    const { default: Loading } = await import("../loading");
    render(<Loading />);

    expect(screen.getByRole("status")).toHaveTextContent("Werkstattdaten werden geladen.");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByLabelText("Werkstatt", { selector: "section" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("phillip-loading-workbench").className).toMatch(/loadingWorkbench/);
    expect(screen.getByRole("heading", { name: "Wareneingang" })).toBeInTheDocument();
    expect(screen.queryByText(/WE-001|GA-001|Noch keine Daten erfasst/)).not.toBeInTheDocument();
  });

  it("source-locks the responsive workshop hierarchy, touch targets, and reduced-motion contract", () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), "src/app/warendurchlauf/WarendurchlaufCockpitClient.tsx"),
      "utf8",
    );
    const cssSource = readFileSync(
      resolve(process.cwd(), "src/app/warendurchlauf/PhillipWerkstatt.module.css"),
      "utf8",
    );

    expect(clientSource).toContain('data-testid="phillip-workbench"');
    expect(clientSource).toContain('title="Wareneingang"');
    expect(clientSource).toContain('title="Galvanik / fertig gemeldet"');
    expect(clientSource.indexOf('surface="galvanik"')).toBeLessThan(clientSource.indexOf('surface="wareneingang"'));
    expect(clientSource).toContain('aria-controls="phillip-order-picker"');
    expect(clientSource).toContain('const pickerOrders = view.kind === "data" ? [...view.galvanik, ...view.wareneingang] : [];');
    expect(clientSource).toContain('className={[styles.primaryAction, styles.touchTarget].join(" ")}');
    expect(clientSource).toContain('className={`${styles.secondaryAction} ${styles.touchTarget}`} href="/warendurchlauf/galvanik"');
    expect(clientSource).toContain('className={`${styles.secondaryAction} ${styles.touchTarget}`}');
    expect(cssSource).toMatch(/\.touchTarget\s*\{[^}]*min-height:\s*48px;/);
    expect(cssSource).toMatch(/\.pickerClose\s*\{[^}]*min-width:\s*48px;/);
    expect(cssSource).toMatch(/\.pickerBackdrop\s*\{[^}]*overflow-x:\s*hidden;/);
    expect(cssSource).toMatch(/\.actionBar\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*0;[^}]*max-width:\s*100%;/);
    expect(cssSource).toMatch(/@media \(hover: hover\) and \(pointer: fine\)[\s\S]*\.actionBar\s*\{[^}]*position:\s*relative;/);
    expect(cssSource).toMatch(/@media \(min-width: 64rem\)[\s\S]*grid-template-columns:\s*minmax\(0, 1\.6fr\) minmax\(18rem, 0\.9fr\)/);
    expect(cssSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cssSource).toContain("overflow-x: clip");
    expect(clientSource).not.toMatch(/Demo|Mock|Snooze|Bündel|Ware raus|Zink-Lauf|Heute sichern|Direkt-Freeze|Bäder|scannen/i);
  });

  it("hides the legacy station navigation only on the exact root segment", async () => {
    const { WarendurchlaufRouteNav } = await import("../WarendurchlaufRouteNav");
    const view = render(<WarendurchlaufRouteNav />);

    expect(screen.queryByText("Legacy-Station-Navigation")).not.toBeInTheDocument();
    ports.useSelectedLayoutSegment.mockReturnValue("wareneingang");
    view.rerender(<WarendurchlaufRouteNav />);
    expect(screen.getByText("Legacy-Station-Navigation")).toBeInTheDocument();
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
