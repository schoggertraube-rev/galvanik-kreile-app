import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  orders: vi.fn(),
  openGlobalCreate: vi.fn(),
  openOrder: vi.fn(),
}));

// Der Mock exportiert bewusst NUR den echten Stationsport. Wuerde die Seite
// zusaetzlich getWarendurchlaufKPIs importieren und aufrufen, waere der Wert
// undefined und jeder Data-/Empty-Test wuerde scheitern.
vi.mock("@/app/warendurchlauf/actions", () => ({
  getWareneingangOrdersAction: ports.orders,
}));
vi.mock("@/components/layout/GlobalCreateFlow", () => ({
  requestGlobalCreate: ports.openGlobalCreate,
}));
vi.mock("@/modules/orders/public", () => ({
  OrderQueueRow: ({
    order,
    onOpen,
  }: {
    order: { id: string; orderNumber: string };
    onOpen: (id: string) => void;
  }) => (
    <button
      data-testid={`wareneingang-order-${order.id}`}
      type="button"
      onClick={() => onOpen(order.id)}
    >
      {order.orderNumber}
    </button>
  ),
}));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: () => ({ openOrder: ports.openOrder }),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("lucide-react", () => {
  const Icon = () => null;
  return {
    Camera: Icon,
    PenLine: Icon,
    Phone: Icon,
    MessageSquare: Icon,
    Clock: Icon,
    ChevronRight: Icon,
  };
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

const intakeControlNames = [/Wareneingang anlegen/i];

beforeEach(() => {
  vi.resetAllMocks();
  ports.orders.mockResolvedValue({ ok: true, data: [] });
});

afterEach(() => cleanup());

describe("F1.1 Wareneingang placement", () => {
  it("opens exactly the order-intake flow and reloads the real station port after confirmation", async () => {
    render(<WareneingangPage />);
    await waitFor(() => expect(ports.orders).toHaveBeenCalledTimes(1));

    fireEvent.click(
      screen.getByRole("button", { name: /Wareneingang anlegen/i }),
    );
    expect(ports.openGlobalCreate).toHaveBeenCalledTimes(1);
    expect(ports.openGlobalCreate).toHaveBeenCalledWith("DIRECT_INTAKE");

    window.dispatchEvent(
      new CustomEvent("order-intake:created", {
        detail: { orderId: "order-a" },
      }),
    );
    await waitFor(() => expect(ports.orders).toHaveBeenCalledTimes(2));
  });

  it("opens the one V8 card from the real station payload", async () => {
    ports.orders.mockResolvedValueOnce({ ok: true, data: [stationOrder] });

    render(<WareneingangPage />);
    const order = await screen.findByRole("button", { name: "A-2026-0001" });
    fireEvent.click(order);
    expect(ports.openOrder).toHaveBeenCalledWith("order-conflict");
  });
});

describe("F1.1 Wareneingang truthful states", () => {
  it("shows only the loading state while the real station read is still pending", async () => {
    let resolveStationOrders!: (value: { ok: true; data: [] }) => void;
    ports.orders.mockReturnValueOnce(
      new Promise<{ ok: true; data: [] }>((resolvePromise) => {
        resolveStationOrders = resolvePromise;
      }),
    );

    const view = render(<WareneingangPage />);

    await waitFor(() =>
      expect(screen.getByTestId("wareneingang-loading")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("wareneingang-loading")).toHaveAttribute(
      "role",
      "status",
    );
    expect(
      screen.getByText("Stationsliste wird geladen.", { exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Noch keine Daten erfasst."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-denied")).not.toBeInTheDocument();

    view.unmount();
    resolveStationOrders({ ok: true, data: [] });
  });

  it("shows the empty state only after a successfully read empty station list", async () => {
    ports.orders.mockResolvedValueOnce({ ok: true, data: [] });
    render(<WareneingangPage />);

    await waitFor(() =>
      expect(screen.getByText("Noch keine Daten erfasst.")).toBeInTheDocument(),
    );
    expect(screen.getByText("0", { exact: true })).toBeInTheDocument();
    expect(
      screen.queryByTestId("wareneingang-loading"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wareneingang-denied")).not.toBeInTheDocument();
  });

  it("renders station cards only from the real station payload", async () => {
    ports.orders.mockResolvedValueOnce({ ok: true, data: [stationOrder] });
    render(<WareneingangPage />);

    await waitFor(() =>
      expect(
        screen.getByTestId("wareneingang-order-order-conflict"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("1", { exact: true })).toBeInTheDocument();
    expect(
      screen.queryByText("Noch keine Daten erfasst."),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["AUTH_ERROR", "Sitzung oder Berechtigung ist nicht verfügbar."],
    ["FORBIDDEN", "Stationsliste ist nicht erlaubt."],
  ])(
    "denies the station on %s without cards, empty success or intake controls",
    async (error, message) => {
      ports.orders.mockResolvedValueOnce({ ok: false, error, message });
      render(<WareneingangPage />);

      await waitFor(() =>
        expect(screen.getByTestId("wareneingang-denied")).toBeInTheDocument(),
      );
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.getByTestId("wareneingang-denied")).toHaveAttribute(
        "role",
        "status",
      );

      expect(
        screen.queryByText("Noch keine Daten erfasst."),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("wareneingang-order-order-conflict"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Aktuelle Aufträge im Wareneingang"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("wareneingang-loading"),
      ).not.toBeInTheDocument();
      for (const name of intakeControlNames) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      }
      expect(
        screen.queryByRole("link", { name: /Telefonnotiz/i }),
      ).not.toBeInTheDocument();
      expect(ports.openGlobalCreate).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["UNAVAILABLE"],
    ["QUERY_ERROR"],
    ["NOT_AVAILABLE"],
  ])(
    "reports %s as an error without cards or empty success",
    async (error) => {
      ports.orders.mockResolvedValueOnce({
        ok: false,
        error,
        message: "Interner Lesefehler",
      });
      render(<WareneingangPage />);

      await waitFor(() =>
        expect(screen.getByTestId("wareneingang-error")).toBeInTheDocument(),
      );
      expect(
        screen.getByText(/Die Aufträge im Wareneingang sind gerade nicht abrufbar/i),
      ).toBeInTheDocument();
      expect(screen.getByText("Technische Details für Support")).toBeInTheDocument();
      expect(
        screen.queryByText("Noch keine Daten erfasst."),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("wareneingang-order-order-conflict"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("wareneingang-denied"),
      ).not.toBeInTheDocument();
    },
  );

  it("reports a throwing station read as an error without cards or empty success", async () => {
    ports.orders.mockRejectedValueOnce(new Error("network failure"));
    render(<WareneingangPage />);

    await waitFor(() =>
      expect(screen.getByTestId("wareneingang-error")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(
        /Die Aufträge im Wareneingang sind gerade nicht abrufbar/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Noch keine Daten erfasst."),
    ).not.toBeInTheDocument();
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
    expect(source).not.toMatch(
      /Tagesstand|Checkliste Heute|Termintreue|Durchlaufzeit|Engpass/,
    );
  });
});
