import { chromium, webkit, type Browser, type BrowserType, type Page } from "@playwright/test";
import { cleanup, render, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import shellStyles from "@/components/layout/TargetShell.module.css";

type ShellPermissionSnapshot = {
  loading: boolean;
  role: string | null;
  status: "authenticated" | "unauthenticated" | "error";
  error: string | null;
  permissions: string[];
  name: string;
  initials: string;
  hasPermission: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
};

const boundary = vi.hoisted(() => ({
  floatingParkedCall: vi.fn(),
  permissions: {
    loading: false,
    role: "buero",
    status: "authenticated",
    error: null,
    permissions: ["perm_view_leitstand", "perm_view_customers"],
    name: "Rolf",
    initials: "R",
    hasPermission: vi.fn((permission: string) =>
      ["perm_view_leitstand", "perm_view_customers"].includes(permission)),
    refreshPermissions: vi.fn(async () => {}),
  } as ShellPermissionSnapshot,
  parkedCallProvider: vi.fn(),
  pathname: { value: "/start" },
  realtimeSyncProvider: vi.fn(),
}));

function setPermissionSnapshot(role: string, permissions: string[]) {
  const identity = role === "werkstatt"
    ? { name: "Phillip", initials: "P" }
    : role === "admin" || role === "developer"
      ? { name: "Gregor", initials: "G" }
      : { name: "Rolf", initials: "R" };

  boundary.permissions = {
    loading: false,
    role,
    status: "authenticated",
    error: null,
    permissions,
    ...identity,
    hasPermission: vi.fn((permission: string) => permissions.includes(permission)),
    refreshPermissions: vi.fn(async () => {}),
  };
}

vi.mock("next/navigation", () => ({
  usePathname: () => boundary.pathname.value,
}));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => boundary.permissions,
}));
vi.mock("@/components/layout/TargetHeader", () => ({
  TargetHeader: () => <div data-testid="target-header-marker" />,
  MoreMenu: () => null,
}));
vi.mock("@/components/layout/TargetNavigation", () => ({
  TargetNavigation: () => <div data-testid="target-navigation-marker" />,
}));
vi.mock("@/components/layout/MobileBottomNav", () => ({
  MobileBottomNav: () => <div data-testid="mobile-bottom-nav-marker" />,
}));
vi.mock("@/components/layout/SessionWarningBanner", () => ({
  SessionWarningBanner: ({ show }: { show: boolean }) => (
    <div data-show={String(show)} data-testid="session-warning-marker" />
  ),
}));
vi.mock("@/components/layout/EntityOverlayStack", () => ({
  EntityOverlayStack: () => <div data-testid="entity-overlay-stack-marker" />,
}));
vi.mock("@/components/layout/RealtimeSyncManager", () => ({
  RealtimeSyncProvider: ({ children }: { children: React.ReactNode }) => {
    boundary.realtimeSyncProvider();
    return <div data-testid="realtime-sync-provider-marker">{children}</div>;
  },
}));
vi.mock("@/contexts/ParkedCallContext", () => ({
  ParkedCallProvider: ({ children }: { children: React.ReactNode }) => {
    boundary.parkedCallProvider();
    return <div data-testid="parked-call-provider-marker">{children}</div>;
  },
}));
vi.mock("@/components/telefonnotiz/FloatingParkedCall", () => ({
  FloatingParkedCall: () => {
    boundary.floatingParkedCall();
    return <div data-testid="floating-parked-call-marker" />;
  },
}));

import { KreileAppShell } from "@/components/layout/KreileAppShell";

function renderShell(pathname: string) {
  boundary.pathname.value = pathname;
  return render(
    <KreileAppShell>
      <div data-testid="children-marker" />
    </KreileAppShell>,
  );
}

function expectRemovedBrowserProvidersAbsent() {
  expect(boundary.realtimeSyncProvider).not.toHaveBeenCalled();
  expect(boundary.parkedCallProvider).not.toHaveBeenCalled();
  expect(boundary.floatingParkedCall).not.toHaveBeenCalled();
  expect(screen.queryByTestId("realtime-sync-provider-marker")).not.toBeInTheDocument();
  expect(screen.queryByTestId("parked-call-provider-marker")).not.toBeInTheDocument();
  expect(screen.queryByTestId("floating-parked-call-marker")).not.toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks();
  setPermissionSnapshot("buero", ["perm_view_leitstand", "perm_view_customers"]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("W2C-B2M5V global browser provider containment", () => {
  it.each(["/start", "/login"])("keeps %s minimal without global browser providers", (pathname) => {
    renderShell(pathname);

    expect(screen.getByTestId("children-marker")).toBeInTheDocument();
    expect(screen.queryByTestId("entity-overlay-stack-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("target-header-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("target-navigation-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-bottom-nav-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("session-warning-marker")).not.toBeInTheDocument();
    expectRemovedBrowserProvidersAbsent();
  });

  it("keeps the authenticated shell UI while removed browser providers stay inert", () => {
    renderShell("/orders");

    expect(screen.getByTestId("children-marker")).toBeInTheDocument();
    expect(screen.getByTestId("target-header-marker")).toBeInTheDocument();
    expect(screen.getByTestId("target-navigation-marker")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-bottom-nav-marker")).toBeInTheDocument();
    expect(screen.getByTestId("session-warning-marker")).toHaveAttribute("data-show", "false");
    expect(screen.getByTestId("entity-overlay-stack-marker")).toBeInTheDocument();
    expectRemovedBrowserProvidersAbsent();
  });

  it.each(["meister", "buero"])(
    "composes the Rolf desktop and mobile navigation for authenticated %s",
    (role) => {
      setPermissionSnapshot(role, ["perm_view_leitstand", "perm_view_customers"]);
      const { container } = renderShell("/orders");

      expect(screen.getByTestId("target-navigation-marker")).toBeInTheDocument();
      expect(screen.getByTestId("mobile-bottom-nav-marker")).toBeInTheDocument();
      const shell = container.querySelector(`.${shellStyles.shell}`);
      expect(shell).toBeInTheDocument();
      expect(shell).toHaveClass(shellStyles.shell);
      expect(shell).not.toHaveClass(shellStyles.workshop);
    },
  );

  it("keeps Phillip on the workshop shell without Rolf sidebar or mobile dock", () => {
    setPermissionSnapshot("werkstatt", ["perm_view_leitstand", "perm_view_customers"]);
    const { container } = renderShell("/warendurchlauf");

    expect(screen.getByTestId("target-header-marker")).toBeInTheDocument();
    expect(screen.queryByTestId("target-navigation-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-bottom-nav-marker")).not.toBeInTheDocument();
    expect(container.querySelector(`.${shellStyles.shell}`)).toHaveClass(shellStyles.workshop);
  });

  it("uses the single permission bootstrap truth for the session warning", () => {
    boundary.permissions.status = "error";
    renderShell("/orders");
    expect(screen.getByTestId("session-warning-marker")).toHaveAttribute("data-show", "true");
  });

  it("removes unsafe global providers and composes the single app-side entity stack", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/layout/KreileAppShell.tsx"),
      "utf8",
    );

    for (const removed of [
      "RealtimeSyncProvider",
      "ParkedCallProvider",
      "FloatingParkedCall",
      "./RealtimeSyncManager",
      "@/contexts/ParkedCallContext",
      "@/components/telefonnotiz/FloatingParkedCall",
      "getSystemStats",
      "isDemoMode",
      "Demo-/Offline Banner",
      "Supabase nicht erreichbar oder deaktiviert",
    ]) expect(source).not.toContain(removed);

    expect(source).toContain("<EntityOverlayStack />");
    expect(source).not.toMatch(/OrderOverlay|CustomerOverlay/);
  });

  it("keeps the touch-tablet navigation out of the desktop sidebar overlap", () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), "src/components/layout/KreileAppShell.tsx"),
      "utf8",
    );
    expect(shellSource).toContain("<TargetNavigation />");
    expect(shellSource).toContain("<MobileBottomNav />");
    expect(shellSource).not.toContain("RightNav");
    expect(shellSource).not.toContain("MobileNav");
  });

});

/**
 * Real-viewport geometry regression for the A1 tablet shell.
 *
 * This is TEST EVIDENCE, not a product run: an isolated harness page is laid out by a real
 * browser engine. It contains (a) the unmodified `TargetShell.module.css` bytes from disk and
 * (b) the real server-rendered markup of `KreileAppShell` / `TargetNavigation` /
 * `MobileBottomNav`. Nothing about auth, routing, data or Vercel is exercised or claimed here.
 * LOCAL_AUTH_EVIDENCE_BLOCKED is untouched by this test.
 */
const SHELL_CSS_PATH = "src/components/layout/TargetShell.module.css";

/**
 * Tailwind-preflight equivalent for exactly the properties that influence the measured boxes.
 * Deliberately tiny so the harness cannot manufacture a layout that the product CSS does not
 * already produce.
 */
const HARNESS_RESET = "*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}"
  + "a{text-decoration:none;color:inherit}svg{display:block}button{font:inherit}";

interface GeometryCase {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly chrome: "sidebar" | "dock";
  readonly headerHeight: number;
  readonly pagePaddingBottom: string;
  readonly createRightInset: number;
  readonly createBottomInset: number;
  readonly dockInlineInset: number | null;
}

type GeometryRole = "buero";
type GeometryMatrixCase = GeometryCase & { readonly role: GeometryRole };

const GEOMETRY_CASES: readonly GeometryCase[] = [
  {
    name: "Desktop 1914x917",
    width: 1914,
    height: 917,
    chrome: "sidebar",
    headerHeight: 76,
    pagePaddingBottom: "46px",
    createRightInset: 42,
    createBottomInset: 24,
    dockInlineInset: null,
  },
  {
    name: "Tablet 1220x880",
    width: 1220,
    height: 880,
    chrome: "dock",
    headerHeight: 68,
    pagePaddingBottom: "98px",
    createRightInset: 18,
    createBottomInset: 92,
    dockInlineInset: 12,
  },
  {
    name: "Mobile 390x844",
    width: 390,
    height: 844,
    chrome: "dock",
    headerHeight: 68,
    pagePaddingBottom: "126px", // Canonical fixed-dock/create runway; mirrors TargetShell mobile scroll contract.
    createRightInset: 12,
    createBottomInset: 88,
    dockInlineInset: 8,
  },
];

const GEOMETRY_MATRIX: readonly GeometryMatrixCase[] = GEOMETRY_CASES.map((viewport) => ({
  ...viewport,
  name: `buero ${viewport.name}`,
  role: "buero",
}));

function resolveGeometryEngine(): BrowserType | null {
  for (const engine of [chromium, webkit]) {
    try {
      const executable = engine.executablePath();
      if (executable && existsSync(executable)) return engine;
    } catch {
      // Engine binary not downloaded in this environment.
    }
  }
  return null;
}

const geometryEngine = resolveGeometryEngine();

function markerPattern(testId: string): RegExp {
  return new RegExp(`<div[^>]*data-testid="${testId}"[^>]*></div>`);
}

async function buildHarnessMarkup(role: GeometryRole): Promise<string> {
  boundary.pathname.value = "/orders";
  setPermissionSnapshot(role, ["perm_view_leitstand", "perm_view_customers"]);

  // `vi.importActual` returns the real modules while their boundary deps (next/navigation,
  // PermissionsContext) stay mocked, so the markup below is product markup.
  const shellModule = await vi.importActual<typeof import("@/components/layout/KreileAppShell")>(
    "@/components/layout/KreileAppShell",
  );
  const navigationModule = await vi.importActual<typeof import("@/components/layout/TargetNavigation")>(
    "@/components/layout/TargetNavigation",
  );
  const dockModule = await vi.importActual<typeof import("@/components/layout/MobileBottomNav")>(
    "@/components/layout/MobileBottomNav",
  );

  // The floating global action is owned by GlobalCreateFlow; bind the harness trigger to that
  // product truth instead of inventing a class name.
  const createFlowSource = readFileSync(
    resolve(process.cwd(), "src/components/layout/GlobalCreateFlow.tsx"),
    "utf8",
  );
  expect(createFlowSource).toContain('<button type="button" className={styles.globalCreateButton}');

  let markup = renderToStaticMarkup(
    <shellModule.KreileAppShell
      globalCreate={
        <button type="button" className={shellStyles.globalCreateButton} aria-haspopup="dialog" aria-expanded={false}>
          <svg aria-hidden="true" viewBox="0 0 24 24" /> <span>Anlegen</span>
        </button>
      }
    >
      <div data-harness="page-content" />
    </shellModule.KreileAppShell>,
  );

  const substitutions: ReadonlyArray<readonly [string, string]> = [
    // TargetHeader is a stub: only its `.header` box participates in the measured grid, and its
    // internals (logout server action, global search) are irrelevant to shell geometry.
    ["target-header-marker", `<header class="${shellStyles.header}" data-harness="header"></header>`],
    ["target-navigation-marker", renderToStaticMarkup(<navigationModule.TargetNavigation />)],
    ["mobile-bottom-nav-marker", renderToStaticMarkup(<dockModule.MobileBottomNav />)],
    // Both render `null` in the authenticated, overlay-free state this geometry case describes.
    ["session-warning-marker", ""],
    ["entity-overlay-stack-marker", ""],
  ];

  for (const [testId, replacement] of substitutions) {
    const pattern = markerPattern(testId);
    expect(markup).toMatch(pattern);
    markup = markup.replace(pattern, replacement);
  }

  // Fail loudly if KreileAppShell ever composes another stubbed child: an unaccounted stub would
  // silently change the grid and therefore the measured geometry.
  expect(markup).not.toContain("data-testid");

  // Vitest hashes CSS-module class names (`_shell_<hash>`); map them back onto the raw selectors
  // of the stylesheet file that is injected verbatim below.
  expect(shellStyles.shell).toMatch(/^_shell_[0-9a-z]+$/);
  const hashSuffix = shellStyles.shell.slice("_shell".length);
  markup = markup.replace(new RegExp(`_([A-Za-z0-9]+)${hashSuffix}`, "g"), "$1");
  expect(markup).not.toContain(hashSuffix);

  const shellCss = readFileSync(resolve(process.cwd(), SHELL_CSS_PATH), "utf8");

  return `<!doctype html><html lang="de"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<style>${HARNESS_RESET}</style><style>${shellCss}</style>`
    + `</head><body>${markup}</body></html>`;
}

interface BoxReport {
  readonly count: number;
  readonly display: string;
  readonly position: string;
  readonly paddingBottom: string;
  readonly gridTemplateColumns: string;
  readonly rendered: boolean;
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

async function measureShell(page: Page) {
  return page.evaluate(() => {
    const read = (selector: string) => {
      const nodes = document.querySelectorAll(selector);
      const element = nodes[0];
      if (!element) return { count: 0, rendered: false } as unknown as BoxReport;
      const computed = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        count: nodes.length,
        display: computed.display,
        position: computed.position,
        paddingBottom: computed.paddingBottom,
        gridTemplateColumns: computed.gridTemplateColumns,
        rendered:
          computed.display !== "none"
          && computed.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0,
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      shell: read(".shell"),
      header: read(".header"),
      body: read(".body"),
      page: read(".page"),
      sidebar: read(".sidebar"),
      dock: read(".mobileDock"),
      create: read(".globalCreateButton"),
    };
  }) as Promise<{
    viewport: { width: number; height: number };
    shell: BoxReport;
    header: BoxReport;
    body: BoxReport;
    page: BoxReport;
    sidebar: BoxReport;
    dock: BoxReport;
    create: BoxReport;
  }>;
}

describe.skipIf(!geometryEngine)(
  "W2C-B2M5V tablet shell geometry — real browser layout of TargetShell.module.css",
  () => {
    let browser: Browser;
    let harnessHtml: Record<GeometryRole, string>;

    beforeAll(async () => {
      harnessHtml = {
        buero: await buildHarnessMarkup("buero"),
      };
      const engine = geometryEngine;
      if (!engine) throw new Error("geometry engine unavailable");
      browser = await engine.launch();
    }, 180_000);

    afterAll(async () => {
      await browser?.close();
    });

    it.each(GEOMETRY_MATRIX)(
      "$name renders the canonical chrome without a floating-action/dock overlap",
      async (viewport) => {
        const page = await browser.newPage({
          viewport: { width: viewport.width, height: viewport.height },
        });
        try {
          await page.setContent(harnessHtml[viewport.role], { waitUntil: "load" });
          const measured = await measureShell(page);

          expect(measured.viewport).toEqual({ width: viewport.width, height: viewport.height });
          expect(measured.shell.rendered).toBe(true);
          expect(Math.round(measured.shell.height)).toBe(viewport.height);

          // Header row of the shell grid.
          expect(measured.header.count).toBe(1);
          expect(Math.round(measured.header.height)).toBe(viewport.headerHeight);

          // Exactly one sidebar and one dock exist in the DOM; the breakpoint decides which one
          // actually occupies space.
          expect(measured.sidebar.count).toBe(1);
          expect(measured.dock.count).toBe(1);

          if (viewport.chrome === "sidebar") {
            expect(measured.sidebar.rendered).toBe(true);
            expect(Math.round(measured.sidebar.width)).toBe(248);
            expect(Math.round(measured.sidebar.left)).toBe(0);
            expect(Math.round(measured.sidebar.top)).toBe(viewport.headerHeight);
            expect(Math.round(measured.sidebar.height)).toBe(viewport.height - viewport.headerHeight);
            expect(measured.body.gridTemplateColumns).toMatch(/^248px /);

            expect(measured.dock.display).toBe("none");
            expect(measured.dock.rendered).toBe(false);
          } else {
            expect(measured.sidebar.display).toBe("none");
            expect(measured.sidebar.rendered).toBe(false);

            expect(measured.dock.rendered).toBe(true);
            expect(measured.dock.display).toBe("flex");
            expect(measured.dock.position).toBe("fixed");
            expect(measured.dock.height).toBeGreaterThanOrEqual(70);
            expect(Math.round(measured.dock.left)).toBe(viewport.dockInlineInset);
            expect(Math.round(viewport.width - measured.dock.right)).toBe(viewport.dockInlineInset);
            expect(Math.round(viewport.height - measured.dock.bottom)).toBe(10);

            // Scrollable page keeps a bottom runway that clears the fixed dock.
            expect(parseFloat(measured.page.paddingBottom))
              .toBeGreaterThanOrEqual(viewport.height - measured.dock.top);
          }

          expect(measured.page.paddingBottom).toBe(viewport.pagePaddingBottom);

          // Global "+" action: anchored bottom-right and never covering the dock.
          expect(measured.create.count).toBe(1);
          expect(measured.create.rendered).toBe(true);
          expect(measured.create.position).toBe("fixed");
          expect(measured.create.height).toBeGreaterThanOrEqual(52);
          expect(Math.round(viewport.width - measured.create.right)).toBe(viewport.createRightInset);
          expect(Math.round(viewport.height - measured.create.bottom)).toBe(viewport.createBottomInset);
          expect(measured.create.bottom).toBeLessThanOrEqual(viewport.height);

          if (viewport.chrome === "dock") {
            const horizontallyApart =
              measured.create.right <= measured.dock.left || measured.create.left >= measured.dock.right;
            const verticallyApart =
              measured.create.bottom <= measured.dock.top || measured.create.top >= measured.dock.bottom;
            expect(horizontallyApart || verticallyApart).toBe(true);
            expect(measured.create.bottom).toBeLessThanOrEqual(measured.dock.top);
          }
        } finally {
          await page.close();
        }
      },
      120_000,
    );
  },
);
