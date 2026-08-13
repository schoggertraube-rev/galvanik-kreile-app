import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KreileHeader } from "@/components/layout/KreileHeader";

type RealtimeStatus = "active" | "connecting" | "disconnected" | "disabled";
type OutboxStatus = "draft" | "queued" | "syncing" | "synced" | "failed" | "conflict";

const boundary = vi.hoisted(() => {
  const syncNow = vi.fn();

  return {
    logout: vi.fn(),
    onMenuToggle: vi.fn(),
    openErfassung: vi.fn(),
    realtime: { status: "disabled" as RealtimeStatus },
    routerReplace: vi.fn(),
    sync: {
      isOnline: true,
      outboxItems: [] as Array<{ status: OutboxStatus }>,
      syncNow,
    },
    syncNow,
  };
});

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span aria-label={alt} role="img" />,
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: boundary.routerReplace }),
}));
vi.mock("@/app/actions/auth", () => ({ logout: boundary.logout }));
vi.mock("@/components/layout/RealtimeSyncManager", () => ({
  useRealtimeStatus: () => boundary.realtime,
}));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({ initials: "", name: "", status: "unauthenticated" }),
}));
vi.mock("@/lib/offline/SyncContext", () => ({
  useSync: () => boundary.sync,
}));
vi.mock("@/components/erfassung/ErfassungProvider", () => ({
  useErfassung: () => ({ openErfassung: boundary.openErfassung }),
}));

function renderHeader() {
  return render(<KreileHeader onMenuToggle={boundary.onMenuToggle} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  boundary.realtime.status = "disabled";
  boundary.sync.isOnline = true;
  boundary.sync.outboxItems = [];
});

afterEach(() => {
  cleanup();
});

describe("W2C header truth", () => {
  it("renders online without pending work as a non-interactive device signal", () => {
    const { container } = renderHeader();

    const networkStatus = screen.getByRole("status", { name: "Netzwerkstatus" });
    expect(networkStatus.textContent).toBe("Netzwerk verfügbar");
    expect(networkStatus.tagName).toBe("DIV");
    expect(boundary.syncNow).not.toHaveBeenCalled();
    expect(container.querySelector("svg.lucide-bell")).toBeNull();
  });

  it("counts only non-synced local entries without claiming a synchronization", () => {
    boundary.sync.outboxItems = [
      { status: "queued" },
      { status: "failed" },
      { status: "synced" },
    ];

    renderHeader();

    expect(screen.getByRole("status", { name: "Netzwerkstatus" }).textContent).toBe("2 lokal ausstehend");
    expect(screen.queryByText("Syncing...", { exact: true })).not.toBeInTheDocument();
    expect(boundary.syncNow).not.toHaveBeenCalled();
  });

  it("renders the offline device signal exactly", () => {
    boundary.sync.isOnline = false;

    renderHeader();

    expect(screen.getByRole("status", { name: "Netzwerkstatus" }).textContent).toBe("Offline");
    expect(boundary.syncNow).not.toHaveBeenCalled();
  });

  it.each([
    ["active", "Echtzeit aktiv"],
    ["connecting", "Echtzeit verbindet…"],
    ["disconnected", "Echtzeit getrennt"],
    ["disabled", null],
  ] as const)("renders the %s realtime state truthfully", (status, expectedLabel) => {
    boundary.realtime.status = status;

    renderHeader();

    const allLabels = ["Echtzeit aktiv", "Echtzeit verbindet…", "Echtzeit getrennt"];
    allLabels.forEach((label) => {
      if (label === expectedLabel) {
        expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
      } else {
        expect(screen.queryByText(label, { exact: true })).not.toBeInTheDocument();
      }
    });
  });

  it("preserves menu, generic capture and scan interactions", () => {
    const { container } = renderHeader();
    const menuButton = container.querySelector("svg.lucide-menu")?.closest("button");

    expect(menuButton).not.toBeNull();
    fireEvent.click(menuButton!);
    fireEvent.click(screen.getByTitle("Neu anlegen"));
    fireEvent.click(screen.getByTitle("Schnellannahme (Scan)"));

    expect(boundary.onMenuToggle).toHaveBeenCalledTimes(1);
    expect(boundary.openErfassung).toHaveBeenNthCalledWith(1, { mode: "gate" });
    expect(boundary.openErfassung).toHaveBeenNthCalledWith(2, { mode: "scan" });
  });

  it("contains no fabricated notification or synchronization claims in the source", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/layout/KreileHeader.tsx"), "utf8");
    const oldClaims = [
      "Offline Modus aktiv",
      "Klicken zum Synchronisieren",
      "Online und synchron",
      "Syncing...",
      "Benachrichtigungen",
      "3 Neu",
      "Materialengpass Galvanik",
      "5 Aufträge fertiggestellt",
      "Kundenanfrage verzögert",
    ];

    oldClaims.forEach((claim) => expect(source).not.toContain(claim));
    expect(source).not.toMatch(/\bBell\b/);
    expect(source).not.toMatch(/\bOfflineManager\b/);
    expect(source).not.toMatch(/\bgetOrderCountDb\b/);
  });
});
