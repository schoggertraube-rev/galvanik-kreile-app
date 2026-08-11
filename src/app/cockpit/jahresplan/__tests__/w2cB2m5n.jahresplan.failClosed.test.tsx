import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const denial = "NOT_AVAILABLE: Jahresplan-Speichern benötigt den W3-Command-Vertrag.";

const ports = vi.hoisted(() => {
  const maybeSingle = vi.fn(async () => ({ data: { werte: { monate: { "1": 12500, "2": 13000 } } }, error: null }));
  const query = { eq: vi.fn(), maybeSingle };
  query.eq.mockReturnValue(query);
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));
  return {
    createAuthorizedDataClient: vi.fn(async () => ({ from })),
    createAuthorizedDataContext: vi.fn(),
    createClient: vi.fn(),
    from,
    select,
    query,
    maybeSingle,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createAuthorizedDataClient: ports.createAuthorizedDataClient,
  createAuthorizedDataContext: ports.createAuthorizedDataContext,
  createClient: ports.createClient,
}));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("lucide-react", () => ({ ArrowLeft: () => null, Lock: () => null, Save: () => null }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("W2C-B2M5N Jahresplan fail-closed", () => {
  it("denies representative writes without opening an authorization or data port", async () => {
    const { speichereJahresplan } = await import("../../actions");

    await expect(speichereJahresplan(2027, { "1": 12500, "12": 24500 })).resolves.toEqual({
      ok: false,
      error: "NOT_AVAILABLE",
      message: denial,
    });

    expect(ports.createAuthorizedDataContext).not.toHaveBeenCalled();
    expect(ports.createAuthorizedDataClient).not.toHaveBeenCalled();
    expect(ports.createClient).not.toHaveBeenCalled();
    expect(ports.from).not.toHaveBeenCalled();
    expect(ports.select).not.toHaveBeenCalled();
    expect(ports.query.eq).not.toHaveBeenCalled();
    expect(ports.maybeSingle).not.toHaveBeenCalled();
  });

  it("source-locks the isolated writer and preserves the forecast-version read filters", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/cockpit/actions.ts"), "utf8");
    const writer = source.match(/export async function speichereJahresplan\([^]*?\n}\n\nexport async function savePhoneNote/);
    const reader = source.match(/export async function getAktiverJahresplan\([^]*?\n}\n\nexport async function speichereJahresplan/);

    expect(writer?.[0]).toBe(`export async function speichereJahresplan(jahr: number, monate: Record<string, number>) {\n  void jahr;\n  void monate;\n  return { ok: false as const, error: "NOT_AVAILABLE" as const, message: "${denial}" };\n}\n\nexport async function savePhoneNote`);
    expect(reader?.[0]).toContain("createAuthorizedDataClient('read')");
    expect(reader?.[0]).toContain(".from('forecast_version')");
    expect(reader?.[0]).toContain(".eq('tenant_id', 'galvanik-kreile')");
    expect(reader?.[0]).toContain(".eq('jahr', jahr)");
    expect(reader?.[0]).toContain(".eq('version_typ', 'plan')");
    expect(reader?.[0]).toContain(".eq('ist_aktiv', true)");
    expect(reader?.[0]).toContain(".maybeSingle()");
  });

  it("renders read values while every Jahresplan write control remains disabled", async () => {
    const { JahresplanClient } = await import("../JahresplanClient");
    render(<JahresplanClient isDevOrAdmin />);

    await waitFor(() => expect(screen.queryByText("Lade Plan...")).not.toBeInTheDocument());
    const yearSelect = screen.getByLabelText("Jahr:");
    const monthInputs = screen.getAllByRole("spinbutton");
    const saveButton = screen.getByRole("button", { name: "Speichern" });
    const monthLabels = [
      "Januar", "Februar", "März", "April", "Mai", "Juni",
      "Juli", "August", "September", "Oktober", "November", "Dezember",
    ];
    const labeledMonthInputs = monthLabels.map((month) => screen.getByLabelText(month));

    expect(yearSelect).toBeDisabled();
    expect(monthInputs).toHaveLength(12);
    expect(labeledMonthInputs).toHaveLength(12);
    expect(monthInputs).toEqual(labeledMonthInputs);
    labeledMonthInputs.forEach((input) => {
      expect(input).toHaveAttribute("type", "number");
      expect(input).toBeDisabled();
    });
    expect(saveButton).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(denial);
    expect(screen.queryByText(/gespeichert/i)).not.toBeInTheDocument();
    expect(ports.createAuthorizedDataContext).not.toHaveBeenCalled();
    expect(ports.createAuthorizedDataClient).toHaveBeenCalledWith("read");
    expect(ports.from).toHaveBeenCalledWith("forecast_version");
    expect(ports.query.eq).toHaveBeenCalledTimes(4);
    expect(ports.query.eq).toHaveBeenNthCalledWith(1, "tenant_id", "galvanik-kreile");
    expect(ports.query.eq).toHaveBeenNthCalledWith(2, "jahr", new Date().getFullYear());
    expect(ports.query.eq).toHaveBeenNthCalledWith(3, "version_typ", "plan");
    expect(ports.query.eq).toHaveBeenNthCalledWith(4, "ist_aktiv", true);
    expect(ports.maybeSingle).toHaveBeenCalledOnce();
  });
});
