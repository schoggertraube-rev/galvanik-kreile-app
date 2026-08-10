import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = { insert: vi.fn(() => { throw new Error("db.insert must not run"); }) };
const requireAdminOrDeveloper = vi.fn(() => { throw new Error("admin guard must not run for logUiEvent"); });

vi.mock("@/db", () => ({ db }));
vi.mock("@/db/schema", () => ({ uiEventsTable: {} }));
vi.mock("@/lib/auth/permissions", () => ({ requireAdminOrDeveloper }));

const denial = {
  ok: false,
  error: "NOT_AVAILABLE",
  message: "NOT_AVAILABLE: UI-Tracking benötigt den W3-Command-Vertrag.",
} as const;
const EXACT_DENIAL_MESSAGE_HEX = "4e4f545f415641494c41424c453a2055492d547261636b696e672062656ec3b6746967742064656e2057332d436f6d6d616e642d566572747261672e";

describe("W2C-B2M5I UI tracking action fail-closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("returns the exact denial before every writer or auth port", async () => {
    const { logUiEvent } = await import("@/app/actions/tracking.actions");
    await expect(logUiEvent({ event_type: "nav_click", route: "/adversarial", meta: { nested: ["<script>", { value: null }] }, device: "attacker", session_id: "session" })).resolves.toEqual(denial);
    expect(db.insert).not.toHaveBeenCalled();
    expect(requireAdminOrDeveloper).not.toHaveBeenCalled();
  });

  it("locks the exact UTF-8 denial bytes, writer body, and read exports", async () => {
    const expectedMessageBytes = Buffer.from(EXACT_DENIAL_MESSAGE_HEX, "hex");
    expect(expectedMessageBytes.toString("utf8")).toBe(denial.message);

    const sourceBytes = await readFile("src/app/actions/tracking.actions.ts");
    expect(sourceBytes.includes(expectedMessageBytes)).toBe(true);

    const source = await readFile("src/app/actions/tracking.actions.ts", "utf8");
    const body = source.match(/export async function logUiEvent[\s\S]*?(?=\nexport async function getRecentUiEvents)/)?.[0] ?? "";
    expect(body).toContain("void event;");
    expect(body).toContain('error: "NOT_AVAILABLE"');
    expect(body).not.toMatch(/\bdb\b|insert|getCurrentAppUser|createId|Date|console|\bimport\b/);
    expect(source).not.toMatch(/import\s+\{\s*(?:createId|getCurrentAppUser)\s*\}/);
    expect(source).toContain("export async function getRecentUiEvents");
    expect(source).toContain("export async function getRealAnalyticsStats");
    expect(source).toContain("await requireAdminOrDeveloper()");
    expect(source).toMatch(/db\s*\.\s*select\(\)/);
  });
});
