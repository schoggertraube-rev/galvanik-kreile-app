import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAdminOrDeveloper = vi.fn();
const mockBcryptHash = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockCreateAuthUser = vi.fn();
const mockDeleteAuthUser = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbTransaction = vi.fn();
const mockTxUpdate = vi.fn();
const mockTxDelete = vi.fn();

vi.mock("@/lib/auth/permissions", () => ({
  requireAdminOrDeveloper: mockRequireAdminOrDeveloper,
}));

vi.mock("bcryptjs", () => ({ default: { hash: mockBcryptHash } }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("@/db", () => ({
  db: {
    insert: mockDbInsert,
    update: mockDbUpdate,
    transaction: mockDbTransaction,
  },
}));

vi.mock("@/db/schema", () => ({
  appUsers: {},
  featureFlags: {},
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

vi.mock("@/lib/auth/userDtos", () => ({ toAdminUserDto: vi.fn() }));

vi.mock("@/lib/server/appSession", () => ({
  APP_TENANT_ID: KREILE_TENANT_SLUG,
}));

const denial = "NOT_AVAILABLE: Sichere Benutzerverwaltung benötigt den W3-Command-Vertrag.";
const corruptedDenialWord = "ben" + "?" + "tigt";

function expectMutationPortsUntouched() {
  expect(mockBcryptHash).not.toHaveBeenCalled();
  expect(mockCreateAdminClient).not.toHaveBeenCalled();
  expect(mockCreateAuthUser).not.toHaveBeenCalled();
  expect(mockDeleteAuthUser).not.toHaveBeenCalled();
  expect(mockDbInsert).not.toHaveBeenCalled();
  expect(mockDbUpdate).not.toHaveBeenCalled();
  expect(mockDbTransaction).not.toHaveBeenCalled();
  expect(mockTxUpdate).not.toHaveBeenCalled();
  expect(mockTxDelete).not.toHaveBeenCalled();
}

describe("admin user writes are fail-closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminOrDeveloper.mockResolvedValue(undefined);
  });

  it("denies every user writer after the guard without mutation side effects", async () => {
    const actions = await import("@/app/actions/admin.actions");
    const calls = [
      () => actions.createUser({ email: "max@example.test", fullName: "Max Mustermann", role: "werkstatt", pin: "4827" }),
      () => actions.updateUserRole("223e4567-e89b-12d3-a456-426614174001", "admin"),
      () => actions.updateUserPin("223e4567-e89b-12d3-a456-426614174001", "5938"),
      () => actions.toggleUserStatus("223e4567-e89b-12d3-a456-426614174001", false),
    ];

    for (const call of calls) {
      await expect(call()).rejects.toThrow(denial);
    }

    expect(mockRequireAdminOrDeveloper).toHaveBeenCalledTimes(4);
    expectMutationPortsUntouched();
  });

  it("propagates a guard denial before every mutation port", async () => {
    const guardError = new Error("ADMIN_DENIED");
    mockRequireAdminOrDeveloper.mockRejectedValue(guardError);
    const actions = await import("@/app/actions/admin.actions");

    await expect(actions.createUser({ email: "max@example.test", fullName: "Max Mustermann", role: "werkstatt", pin: "4827" })).rejects.toBe(guardError);
    await expect(actions.updateUserRole("223e4567-e89b-12d3-a456-426614174001", "admin")).rejects.toBe(guardError);
    await expect(actions.updateUserPin("223e4567-e89b-12d3-a456-426614174001", "5938")).rejects.toBe(guardError);
    await expect(actions.toggleUserStatus("223e4567-e89b-12d3-a456-426614174001", false)).rejects.toBe(guardError);

    expectMutationPortsUntouched();
  });

  it("keeps the user-management UI read-only and visibly unavailable", async () => {
    const source = await readFile("src/components/admin/UserManagement.tsx", "utf8");
    const actionSource = await readFile("src/app/actions/admin.actions.ts", "utf8");

    expect(source).toContain('import { getUsers } from "@/app/actions/admin.actions";');
    expect(source).toContain("await getUsers()");
    expect(source).toContain(denial);
    expect(actionSource).toContain(denial);
    expect(source).not.toContain(corruptedDenialWord);
    expect(actionSource).not.toContain(corruptedDenialWord);
    expect(source).toContain("Benutzermutationen warten auf W3.");
    expect(source).toMatch(/<Button disabled[\s\S]*?Neuer Benutzer/);
    expect(source).toMatch(/<select[\s\S]*?disabled/);
    expect(source).toMatch(/<Button[\s\S]*?disabled[\s\S]*?Aktivieren/);
    expect(source).toMatch(/<Input[\s\S]*?type="password"[\s\S]*?disabled/);
    expect(source).not.toMatch(/<Input[\s\S]*?type="password"[\s\S]*?onChange=/);
    expect(source).not.toMatch(/<Input[\s\S]*?type="password"[\s\S]*?onBlur=/);
    for (const identifier of ["createUser", "updateUserRole", "updateUserPin", "toggleUserStatus"]) {
      expect(source).not.toContain(identifier);
    }
  });
});
