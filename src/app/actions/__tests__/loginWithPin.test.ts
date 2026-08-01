/**
 * loginWithPin.test.ts
 *
 * Unit-Tests für den PIN-Login.
 *
 * Abgedeckte Szenarien:
 *  8a. PIN-Login erstellt vollständige AppSession mit korrektem displayName
 *  8b. PIN-Login mit leerem fullName → Fehler statt UUID-Fallback
 *  8c. Falscher PIN → nicht-ok Ergebnis
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Testschlüssel ──────────────────────────────────────────────────────────
const TEST_SECRET = "test-secret-loginwithpin-unit-tests";
process.env.APP_SESSION_SECRET = TEST_SECRET;

// ─── Mocks ──────────────────────────────────────────────────────────────────
const mockSetAppSession = vi.fn();
const mockVerifyPinLogin = vi.fn();

vi.mock("@/lib/server/appSession", () => ({
  setAppSession: mockSetAppSession,
  clearAppSession: vi.fn(),
  getAppSession: vi.fn().mockResolvedValue(null),
  readAppSession: vi.fn().mockResolvedValue({ ok: false, reason: "NO_COOKIE" }),
  SESSION_TTL_MS: 12 * 60 * 60 * 1000,
  COOKIE_NAME: "kreile_app_session",
}));

vi.mock("@/lib/server/pinAuth", () => ({
  verifyPinLogin: mockVerifyPinLogin,
}));

vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: vi.fn(),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("loginWithPin() – AppSession-Erstellung (A-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetAppSession.mockResolvedValue(undefined);
  });

  it("8a – gültiger PIN mit vollständigem fullName → AppSession wird mit displayName gesetzt", async () => {
    mockVerifyPinLogin.mockResolvedValue({
      ok: true,
      identity: {
        id: "223e4567-e89b-42d3-a456-426614174001",
        tenantId: "galvanik-kreile",
        role: "werkstatt",
        displayName: "Max Mustermann",
      },
    });

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin(
      "223e4567-e89b-42d3-a456-426614174001",
      "6147",
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.role).toBe("werkstatt");

    expect(mockSetAppSession).toHaveBeenCalledOnce();
    const sessionArg = mockSetAppSession.mock.calls[0][0];
    expect(sessionArg.userId).toBe("223e4567-e89b-42d3-a456-426614174001");
    expect(sessionArg.displayName).toBe("Max Mustermann");
    expect(sessionArg.role).toBe("werkstatt");
    expect(sessionArg.tenantId).toBe("galvanik-kreile");
    // Keine UUID als displayName
    expect(sessionArg.displayName).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("8b – fullName leer → Fehler statt UUID-Fallback", async () => {
    mockVerifyPinLogin.mockResolvedValue({
      ok: false,
      message: "Kein Anzeigename für diesen Benutzer konfiguriert. Bitte Administrator kontaktieren.",
    });

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin(
      "323e4567-e89b-42d3-a456-426614174002",
      "6147",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Anzeigename/i);
    }
    // setAppSession darf NICHT aufgerufen worden sein
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("8c – falscher PIN → nicht-ok, keine Session erstellt", async () => {
    mockVerifyPinLogin.mockResolvedValue({
      ok: false,
      message: "Ungültige PIN oder inaktiver Benutzer.",
    });

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin(
      "423e4567-e89b-42d3-a456-426614174003",
      "0000",
    );

    expect(result.ok).toBe(false);
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("8d – Drosselung wird unverändert an die Oberfläche weitergegeben", async () => {
    mockVerifyPinLogin.mockResolvedValue({
      ok: false,
      message: "Zu viele Fehlversuche.",
      retryAfterSeconds: 420,
    });

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    await expect(
      loginWithPin("523e4567-e89b-42d3-a456-426614174004", "6147"),
    ).resolves.toEqual({
      ok: false,
      message: "Zu viele Fehlversuche.",
      retryAfterSeconds: 420,
    });
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("8e – Datenbankfehler loggt weder Error-Objekt noch PIN-Parameter", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const databaseError = Object.assign(new Error("query failed"), {
      params: ["623e4567-e89b-42d3-a456-426614174005", "6147"],
    });
    mockVerifyPinLogin.mockRejectedValue(databaseError);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    await expect(
      loginWithPin("623e4567-e89b-42d3-a456-426614174005", "6147"),
    ).resolves.toEqual({
      ok: false,
      message: "Server-Fehler beim Login.",
    });

    expect(consoleError).toHaveBeenCalledWith(
      "PIN login failed before a session could be created.",
    );
    expect(consoleError.mock.calls.flat()).not.toContain(databaseError);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("6147");
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });
});
