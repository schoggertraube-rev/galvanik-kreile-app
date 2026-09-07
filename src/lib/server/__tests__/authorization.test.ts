process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";

import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveAuthorization } from "../authorization";
import * as appSessionModule from "../appSession";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { checkAppSession, checkAppAuth } from "../authHelper";
import { getAuthorizationSnapshotAction } from "@/app/actions/auth.actions";
import { getRoleLabel, type AppRole } from "@/lib/auth/authorizationContract";

vi.mock("@/db", () => {
  const mockWhere = vi.fn();
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return {
    db: {
      select: mockSelect,
    },
    mockWhere,
  };
});

describe("resolveAuthorization() & centralized Auth-Source", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(db.select().from(appUsers).where).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. gültige Session, aktiver Benutzer, identische Rolle", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: true,
      session: {
        userId: "user-1",
        tenantId: KREILE_TENANT_SLUG,
        role: "admin",
        displayName: "Max Kreile",
        issuedAt: 0,
        expiresAt: Date.now() + 10000,
      },
    });

    vi.mocked(db.select().from(appUsers).where).mockResolvedValue([
      {
        id: "user-1",
        fullName: "Max Kreile",
        role: "admin",
        active: true,
      },
    ] as unknown as Array<typeof appUsers.$inferSelect>);

    const result = await resolveAuthorization();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe("user-1");
      expect(result.data.role).toBe("admin");
      expect(result.data.permissions).toContain("perm_sys_diag");
    }
  });

  it("2. keine Session", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: false,
      reason: "NO_COOKIE",
    });

    const result = await resolveAuthorization();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("NO_SESSION");
      expect(result.message).toBe("AUTH_ERROR: Nicht angemeldet");
    }
  });

  it("3. ungültige Session", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: false,
      reason: "INVALID_SIGNATURE",
    });

    const result = await resolveAuthorization();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("INVALID_SESSION");
      expect(result.message).toBe("AUTH_ERROR: Ungültige Sitzung");
    }
  });

  it("4. Benutzer nicht gefunden", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: true,
      session: {
        userId: "user-1",
        tenantId: KREILE_TENANT_SLUG,
        role: "admin",
        displayName: "Max Kreile",
        issuedAt: 0,
        expiresAt: Date.now() + 10000,
      },
    });

    vi.mocked(db.select().from(appUsers).where).mockResolvedValue([]);

    const result = await resolveAuthorization();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("USER_NOT_FOUND");
      expect(result.message).toBe("AUTH_ERROR: Benutzer nicht gefunden");
    }
  });

  it("5. Benutzer deaktiviert", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: true,
      session: {
        userId: "user-1",
        tenantId: KREILE_TENANT_SLUG,
        role: "admin",
        displayName: "Max Kreile",
        issuedAt: 0,
        expiresAt: Date.now() + 10000,
      },
    });

    vi.mocked(db.select().from(appUsers).where).mockResolvedValue([
      {
        id: "user-1",
        fullName: "Max Kreile",
        role: "admin",
        active: false,
      },
    ] as unknown as Array<typeof appUsers.$inferSelect>);

    const result = await resolveAuthorization();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("USER_INACTIVE");
      expect(result.message).toBe("AUTH_ERROR: Benutzer deaktiviert");
    }
  });

  it("6. Sessionrolle und DB-Rolle weichen ab", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: true,
      session: {
        userId: "user-1",
        tenantId: KREILE_TENANT_SLUG,
        role: "buero",
        displayName: "Max Kreile",
        issuedAt: 0,
        expiresAt: Date.now() + 10000,
      },
    });

    vi.mocked(db.select().from(appUsers).where).mockResolvedValue([
      {
        id: "user-1",
        fullName: "Max Kreile",
        role: "admin",
        active: true,
      },
    ] as unknown as Array<typeof appUsers.$inferSelect>);

    const result = await resolveAuthorization();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("ROLE_MISMATCH");
      expect(result.message).toBe("AUTH_ERROR: Sitzung veraltet");
    }
  });

  it("7. unbekannter DB-Rollenwert", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: true,
      session: {
        userId: "user-1",
        tenantId: KREILE_TENANT_SLUG,
        role: "invalid-role",
        displayName: "Max Kreile",
        issuedAt: 0,
        expiresAt: Date.now() + 10000,
      },
    });

    vi.mocked(db.select().from(appUsers).where).mockResolvedValue([
      {
        id: "user-1",
        fullName: "Max Kreile",
        role: "invalid-role",
        active: true,
      },
    ] as unknown as Array<typeof appUsers.$inferSelect>);

    const result = await resolveAuthorization();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("UNKNOWN_ROLE");
      expect(result.message).toBe("AUTH_ERROR: Unbekannte Rolle");
    }
  });

  it("8. DB-Abfrage schlägt fehl", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: true,
      session: {
        userId: "user-1",
        tenantId: KREILE_TENANT_SLUG,
        role: "admin",
        displayName: "Max Kreile",
        issuedAt: 0,
        expiresAt: Date.now() + 10000,
      },
    });

    vi.mocked(db.select().from(appUsers).where).mockRejectedValue(new Error("DB Connection Error"));

    const result = await resolveAuthorization();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("AUTHORIZATION_UNAVAILABLE");
      expect(result.message).toBe("AUTH_ERROR: Berechtigungen nicht verfügbar");
    }
  });

  it("9. Permission-Mapping korrekt", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: true,
      session: {
        userId: "user-1",
        tenantId: KREILE_TENANT_SLUG,
        role: "werkstatt",
        displayName: "Max Kreile",
        issuedAt: 0,
        expiresAt: Date.now() + 10000,
      },
    });

    vi.mocked(db.select().from(appUsers).where).mockResolvedValue([
      {
        id: "user-1",
        fullName: "Max Kreile",
        role: "werkstatt",
        active: true,
      },
    ] as unknown as Array<typeof appUsers.$inferSelect>);

    const result = await resolveAuthorization();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.permissions).toContain("perm_op_status");
      expect(result.data.permissions).not.toContain("perm_sys_users");
    }
  });

  it("10. Rollenlabel wird zentral abgeleitet", () => {
    expect(getRoleLabel("meister" as AppRole)).toBe("Meister");
    expect(getRoleLabel("admin" as AppRole)).toBe("Administrator");
  });

  it("11. checkAppSession() bleibt DB-frei", async () => {
    const spy = vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: true,
      session: {
        userId: "u1",
        tenantId: KREILE_TENANT_SLUG,
        role: "admin",
        displayName: "Admin User",
        issuedAt: 0,
        expiresAt: Date.now() + 10000,
      },
    });

    const selectSpy = vi.spyOn(db, "select");
    selectSpy.mockClear();

    const result = await checkAppSession();
    expect(spy).toHaveBeenCalled();
    expect(selectSpy).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("12. checkAppAuth() nutzt ausschließlich Resolver", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: true,
      session: {
        userId: "user-1",
        tenantId: KREILE_TENANT_SLUG,
        role: "admin",
        displayName: "Max Kreile",
        issuedAt: 0,
        expiresAt: Date.now() + 10000,
      },
    });

    vi.mocked(db.select().from(appUsers).where).mockResolvedValue([
      {
        id: "user-1",
        fullName: "Max Kreile",
        role: "admin",
        active: true,
      },
    ] as unknown as Array<typeof appUsers.$inferSelect>);

    const result = await checkAppAuth("write");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("admin");
    }
  });

  it("13. Client-Action nutzt ausschließlich Resolver", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: false,
      reason: "NO_COOKIE",
    });

    const result = await getAuthorizationSnapshotAction();
    expect(result.ok).toBe(false);
  });

  it("14. Sicherheitsänderung nach Session-Ausstellung widerruft die Sitzung", async () => {
    const issuedAt = Date.now() - 60_000;
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: true,
      session: {
        userId: "user-1",
        tenantId: KREILE_TENANT_SLUG,
        role: "admin",
        displayName: "Max Kreile",
        issuedAt,
        expiresAt: Date.now() + 10_000,
      },
    });

    vi.mocked(db.select().from(appUsers).where).mockResolvedValue([
      {
        id: "user-1",
        tenantId: KREILE_TENANT_SLUG,
        email: "max@example.test",
        fullName: "Max Kreile",
        role: "admin",
        active: true,
        updatedAt: new Date(issuedAt + 1_000),
      },
    ] as unknown as Array<typeof appUsers.$inferSelect>);

    const result = await resolveAuthorization();

    expect(result).toEqual({
      ok: false,
      reason: "SESSION_REVOKED",
      message: "AUTH_ERROR: Sitzung widerrufen",
    });
  });
});
