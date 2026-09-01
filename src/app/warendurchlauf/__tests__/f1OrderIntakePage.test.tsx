import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  orders: vi.fn(),
  openErfassung: vi.fn(),
  handoffProps: undefined as undefined | {
    onConflictReadback?: (orders: unknown[], message: string) => void;
  },
}));

// Der Mock exportiert bewusst NUR den echten Stationsport. Wuerde die Seite
// zusaetzlich getWarendurchlaufKPIs importieren und aufrufen, waere der Wert
// undefined und jeder Data-/Empty-Test wuerde scheitern.
vi.mock("@/app/warendurchlauf/actions", () => ({
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
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("lucide-react", () => {
  const Icon = () => null;
  return { Camera: Icon, PenLine: Icon, Phone: Icon, MessageSquare: Icon, Clock: Icon, ChevronRight: Icon };
});

import WareneingangPage from "@/app/warendurchlauf/wareneingang/page";

const stationOrder = {
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
};

const intakeControlNames = [/Kamera/i, /Wareneingang anlegen/i];

beforeEach(() => {
  vi.resetAllMocks();
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
    ports.orders.mockResolvedValueOnce({ ok: true, data: [stationOrder] });

    render(<WareneingangPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Konflikt auslösen" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Konflikt auslösen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Auftrag wurde bereits geändert.");
    expect(screen.getByText(/Noch keine Daten erfasst/)).toBeInTheDocument();
  });
});

describe("F1.1 Wareneingang truthful states", () => {
  it("shows only the loading state while the real station read is still pending", async () => {
    let resolveStationOrders!: (value: { ok: true; data: [] }) => void;
    ports.orders.mockReturnValueOnce(new Promise<{ ok: true; data: [] }>((resolvePromise) => {
      resolveStationOrders = resolvePromise;
    }));

    const view = render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByTestId("wareneingang-loading")).toBeInTheDocument());
    expect(screen.getByTestId("wareneingang-loading")).toHaveAttribute("role", "status");
    expect(screen.getByText("Stationsliste wird geladen.", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
    expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-denied")).not.toBeInTheDocument();

    view.unmount();
    resolveStationOrders({ ok: true, data: [] });
  });

  it("shows the empty state only after a successfully read empty station list", async () => {
    ports.orders.mockResolvedValueOnce({ ok: true, data: [] });
    render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByText("Noch keine Daten erfasst.")).toBeInTheDocument());
    expect(screen.getByText("0", { exact: true })).toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-loading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-denied")).not.toBeInTheDocument();
  });

  it("renders station cards only from the real station payload", async () => {
    ports.orders.mockResolvedValueOnce({ ok: true, data: [stationOrder] });
    render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByTestId("wareneingang-order-order-conflict")).toBeInTheDocument());
    expect(screen.getByText("1", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
  });

  it.each([
    ["AUTH_ERROR", "Sitzung oder Berechtigung ist nicht verfügbar."],
    ["FORBIDDEN", "Stationsliste ist nicht erlaubt."],
  ])("denies the station on %s without cards, empty success or intake controls", async (error, message) => {
    ports.orders.mockResolvedValueOnce({ ok: false, error, message });
    render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByTestId("wareneingang-denied")).toBeInTheDocument());
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByTestId("wareneingang-denied")).toHaveAttribute("role", "status");

    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-order-order-conflict")).not.toBeInTheDocument();
    expect(screen.queryByText("Aktuelle Aufträge im Wareneingang")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-loading")).not.toBeInTheDocument();
    for (const name of intakeControlNames) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: /Telefonnotiz/i })).not.toBeInTheDocument();
    expect(ports.openErfassung).not.toHaveBeenCalled();
  });

  it.each([
    ["UNAVAILABLE", "Berechtigungen sind derzeit nicht verfügbar."],
    ["QUERY_ERROR", "Stationsliste konnte nicht sicher geladen werden."],
    ["NOT_AVAILABLE", "NOT_AVAILABLE: Stationsliste ist nicht verfügbar."],
  ])("reports %s as an error without cards or empty success", async (error, message) => {
    ports.orders.mockResolvedValueOnce({ ok: false, error, message });
    render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByTestId("wareneingang-error")).toBeInTheDocument());
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
    expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-order-order-conflict")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-denied")).not.toBeInTheDocument();
  });

  it("reports a throwing station read as an error without cards or empty success", async () => {
    ports.orders.mockRejectedValueOnce(new Error("network failure"));
    render(<WareneingangPage />);

    await waitFor(() => expect(screen.getByTestId("wareneingang-error")).toBeInTheDocument());
    expect(screen.getByText("NOT_AVAILABLE: Stationsliste konnte nicht sicher geladen werden.")).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Daten erfasst.")).not.toBeInTheDocument();
    expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-denied")).not.toBeInTheDocument();
  });

  it("uses no KPI port and no fixed count display", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/warendurchlauf/wareneingang/page.tsx"),
      "utf8",
    );

    expect(source).toContain("getWareneingangOrdersAction()");
    expect(source).not.toContain("getWarendurchlaufKPIs");
    expect(source).not.toContain("kpiUnavailableMessage");
    expect(source).not.toContain("28 gesamt");
    expect(source).not.toMatch(/Tagesstand|Checkliste Heute|Termintreue|Durchlaufzeit|Engpass/);
  });
});
