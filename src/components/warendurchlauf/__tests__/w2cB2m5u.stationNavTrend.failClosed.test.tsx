import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const getAll = vi.hoisted(() => vi.fn());
vi.mock("@/lib/repositories/ordersRepository", () => ({ ordersRepository: { getAll }, Order: {} }));
vi.mock("next/navigation", () => ({ usePathname: () => "/warendurchlauf/galvanik" }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/warendurchlaufIconResolver", () => ({ getCurrentTimeOfDay: () => "noon", getCurrentWeather: () => "normal", getWareneingangVolumeState: () => "normal", getStationIcon: () => "/x.png" }));
import { WarendurchlaufStationNav } from "@/components/warendurchlauf/WarendurchlaufStationNav";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers(); });
const input = (intakeDate: unknown) => ({ id: "o1", station: "wareneingang", status: "ready", intakeDate });

describe("W2C-B2M5U station trend truth", () => {
  it("renders loading without empty, chips, or trend truth", () => {
    getAll.mockReturnValueOnce(new Promise(() => {}));
    render(<WarendurchlaufStationNav />);
    expect(screen.getByText("Stationsdaten werden geladen...")).toBeInTheDocument();
    expect(screen.queryByText("Keine Aufträge")).not.toBeInTheDocument();
    expect(screen.queryByText(/neu$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gesamt \(7T\)/)).not.toBeInTheDocument();
  });

  it("renders rejection fail-closed without stale zero chips or trends", async () => {
    getAll.mockRejectedValueOnce(new Error("offline"));
    render(<WarendurchlaufStationNav />);
    await waitFor(() => expect(screen.getByText("NOT_AVAILABLE: Stationsdaten konnten nicht geladen werden.")).toBeInTheDocument());
    expect(screen.queryByText(/0 neu/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gesamt \(7T\)/)).not.toBeInTheDocument();
  });

  it("renders the genuine empty state after successful empty data", async () => {
    getAll.mockResolvedValueOnce([]);
    render(<WarendurchlaufStationNav />);
    expect((await screen.findAllByText("Keine Aufträge")).length).toBe(3);
  });

  it.each([undefined, "", "   ", "invalid"])("shows unrecorded intake %p without bars or a current-date grouping", async (intakeDate) => {
    getAll.mockResolvedValueOnce([input(intakeDate)]);
    const { container } = render(<WarendurchlaufStationNav />);
    expect(await screen.findByText("Nicht erfasst")).toBeInTheDocument();
    expect(screen.queryByText("1 Gesamt (7T)")).not.toBeInTheDocument();
    expect(container.querySelectorAll('div[class~="w-1.5"][class~="rounded-t-sm"]')).toHaveLength(0);
  });

  it("renders seven real trend bars and the exact persisted-date total", async () => {
    getAll.mockResolvedValueOnce([input(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())]);
    const { container } = render(<WarendurchlaufStationNav />);
    expect(await screen.findByText("1 Gesamt (7T)")).toBeInTheDocument();
    expect(container.querySelectorAll('div[class~="w-1.5"][class~="rounded-t-sm"]')).toHaveLength(7);
  });

  // Struktur-Vertrag: die Basisbreite muss drei echte Spalten mit min-w-0 tragen.
  // Ob im Browser tatsächlich nichts horizontal überläuft, wird extern geprüft — jsdom layoutet nicht.
  it("binds a three-column base structure with shrinkable columns", async () => {
    getAll.mockResolvedValueOnce([]);
    const { container } = render(<WarendurchlaufStationNav />);
    await screen.findAllByText("Keine Aufträge");

    const nav = container.querySelector('[data-testid="station-nav"]');
    expect(nav).not.toBeNull();
    expect(nav!.className).toContain("grid-cols-3");
    expect(nav!.className).toContain("min-w-0");

    const items = container.querySelectorAll('[data-testid^="station-nav-item-"]');
    expect(items).toHaveLength(3);
    items.forEach((item) => {
      const tokens = item.className.split(/\s+/);
      expect(tokens).toContain("min-w-0");
      // Basis darf nicht mehr unschrumpfbar sein; ab md bleibt das bestehende Verhalten.
      expect(tokens).not.toContain("shrink-0");
      expect(tokens).toContain("md:shrink-0");
    });
  });

  it("uses compact base circles instead of the 115px base size", async () => {
    getAll.mockResolvedValueOnce([]);
    const { container } = render(<WarendurchlaufStationNav />);
    await screen.findAllByText("Keine Aufträge");

    expect(container.querySelectorAll('div[class*="w-[115px]"]')).toHaveLength(0);
    expect(container.querySelectorAll('div[class~="w-[76px]"][class~="h-[76px]"]')).toHaveLength(3);
  });
});
