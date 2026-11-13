import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KreileHeader } from "@/components/layout/KreileHeader";
import type {DeviceStandSnapshot} from '@/lib/offline/SyncContext';

type RealtimeStatus = "active" | "connecting" | "disconnected" | "disabled";
type OutboxStatus = "draft" | "queued" | "syncing" | "synced" | "failed" | "conflict";

const boundary = vi.hoisted(() => {
  const syncNow = vi.fn();

  return {
    logout: vi.fn(),
    onMenuToggle: vi.fn(),
    requestGlobalCreate: vi.fn(),
    realtime: { status: "disabled" as RealtimeStatus },
    offline24h:false,
    routerReplace: vi.fn(),
    sync: {
      isOnline: true,
      outboxItems: [] as Array<{ status: OutboxStatus }>,
      deviceStand:{code:'LOADING'} as DeviceStandSnapshot,
      pendingStorageUnavailable:false,
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
vi.mock("@/components/layout/GlobalSearch", () => ({
  GlobalSearch: () => null,
}));
vi.mock("@/components/layout/RealtimeSyncManager", () => ({
  useRealtimeStatus: () => boundary.realtime,
}));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({ initials: "", name: "", status: "unauthenticated",offline24h:boundary.offline24h }),
}));
vi.mock("@/lib/offline/SyncContext", () => ({
  useSync: () => boundary.sync,
}));
vi.mock("@/components/layout/globalCreateRequest", () => ({
  requestGlobalCreate: boundary.requestGlobalCreate,
}));

function renderHeader() {
  return render(<KreileHeader onMenuToggle={boundary.onMenuToggle} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  boundary.realtime.status = "disabled";
  boundary.sync.isOnline = true;
  boundary.sync.outboxItems = [];
  boundary.offline24h=false;boundary.sync.deviceStand={code:'LOADING'};boundary.sync.pendingStorageUnavailable=false;
});

afterEach(() => {
  cleanup();
});

describe("W2C header truth", () => {
  it('S06 uses one visible server-stand line and keeps quarantine outside the waiting count',()=>{
    boundary.offline24h=true;boundary.sync.isOnline=false;
    boundary.sync.deviceStand={code:'COMPLETE',serverReadAt:'2026-11-13T09:30:00.000Z'};
    boundary.sync.outboxItems=[{status:'queued'},{status:'conflict'},{status:'synced'}];
    const clock=vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-13T09:31:00.000Z'));
    try{renderHeader();const line=screen.getByRole('status',{name:'Netzwerkstatus'});expect(line).toHaveTextContent('Offline – Stand 10:30, 1 Änderungen warten');expect(line).toHaveTextContent('1 Eingaben zurückgehalten - tippe zum Zuordnen');expect(line.className).not.toContain('hidden');expect(screen.getAllByRole('status',{name:'Netzwerkstatus'})).toHaveLength(1);expect(boundary.syncNow).not.toHaveBeenCalled();}finally{clock.mockRestore();}
  });
  it('S06 exposes storage failure while existing pending originals remain visible in the projection',()=>{
    boundary.offline24h=true;boundary.sync.pendingStorageUnavailable=true;boundary.sync.outboxItems=[{status:'queued'}];
    renderHeader();expect(screen.getByRole('status',{name:'Netzwerkstatus'})).toHaveTextContent('Offline-Speicher auf diesem Gerät nicht verfügbar - Eingaben gehen nur mit Netz');expect(boundary.sync.outboxItems).toHaveLength(1);expect(boundary.syncNow).not.toHaveBeenCalled();
  });
  it('S06 never displays network availability as a completed stand when its source is incomplete',()=>{
    boundary.offline24h=true;boundary.sync.deviceStand={code:'INCOMPLETE'};
    renderHeader();expect(screen.getByRole('status',{name:'Netzwerkstatus'})).toHaveTextContent('Noch nicht alle Daten auf diesem Gerät – mit Netz lädt die App den Rest automatisch.');expect(screen.queryByText('Netzwerk verfügbar')).toBeNull();
  });
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
    fireEvent.click(screen.getByTitle("Neu erfassen"));
    fireEvent.click(screen.getByTitle("Schnellannahme (Scan)"));

    expect(boundary.onMenuToggle).toHaveBeenCalledTimes(1);
    expect(boundary.requestGlobalCreate).toHaveBeenNthCalledWith(1, "DIRECT_INTAKE");
    expect(boundary.requestGlobalCreate).toHaveBeenNthCalledWith(2, {
      intent: "DIRECT_INTAKE",
      prefill: { sourceMode: "camera" },
    });
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
