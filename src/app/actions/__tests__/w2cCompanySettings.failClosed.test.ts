import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const denial = "NOT_AVAILABLE: Sichere Firmendatenänderung benötigt den W3-Command-Vertrag.";
const mockRequireAdminOrDeveloper = vi.fn();
const mockIsOffline = vi.fn();
const mockCreateClient = vi.fn();
const mockFrom = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/auth/permissions", () => ({
  requireAdminOrDeveloper: mockRequireAdminOrDeveloper,
}));

vi.mock("@/lib/offline/OfflineManager", () => ({
  OfflineManager: { isOffline: mockIsOffline },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mockCreateClient,
}));

describe("company settings writes are fail-closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockRequireAdminOrDeveloper.mockResolvedValue(undefined);
    mockCreateClient.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ upsert: mockUpsert });
  });

  it("denies an authorized action without calling the repository", async () => {
    const { companySettingsRepository } = await import("@/lib/repositories/companySettingsRepository");
    const repositoryUpdate = vi.spyOn(companySettingsRepository, "updateSettings");
    const { updateCompanySettings } = await import("@/app/actions/company.actions");

    await expect(updateCompanySettings({ companyName: "Neu" })).rejects.toThrow(denial);

    expect(mockRequireAdminOrDeveloper).toHaveBeenCalledTimes(1);
    expect(repositoryUpdate).not.toHaveBeenCalled();
  });

  it("propagates a guard rejection without calling the repository", async () => {
    const guardError = new Error("ADMIN_DENIED");
    mockRequireAdminOrDeveloper.mockRejectedValue(guardError);
    const { companySettingsRepository } = await import("@/lib/repositories/companySettingsRepository");
    const repositoryUpdate = vi.spyOn(companySettingsRepository, "updateSettings");
    const { updateCompanySettings } = await import("@/app/actions/company.actions");

    await expect(updateCompanySettings({ companyName: "Neu" })).rejects.toBe(guardError);

    expect(repositoryUpdate).not.toHaveBeenCalled();
  });

  it("denies direct repository writes before every side-effect port", async () => {
    const dateConstructor = vi.fn();
    vi.stubGlobal("Date", dateConstructor);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { companySettingsRepository } = await import("@/lib/repositories/companySettingsRepository");
    const repositoryRead = vi.spyOn(companySettingsRepository, "getSettings");

    await expect(companySettingsRepository.updateSettings({ companyName: "Neu" })).rejects.toThrow(denial);

    expect(mockIsOffline).not.toHaveBeenCalled();
    expect(repositoryRead).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(dateConstructor).not.toHaveBeenCalled();
  });

  it("retains the action read delegation", async () => {
    const { companySettingsRepository } = await import("@/lib/repositories/companySettingsRepository");
    const expected = { companyName: "Kreile" };
    const repositoryRead = vi.spyOn(companySettingsRepository, "getSettings").mockResolvedValue(expected as never);
    const { getCompanySettings } = await import("@/app/actions/company.actions");

    await expect(getCompanySettings()).resolves.toBe(expected);
    expect(repositoryRead).toHaveBeenCalledTimes(1);
  });

  it("keeps the settings UI locally editable but structurally unable to write", async () => {
    const source = await readFile("src/components/admin/CompanySettingsForm.tsx", "utf8");

    expect(source).toContain('import { getCompanySettings } from "@/app/actions/company.actions";');
    expect(source).toContain("await getCompanySettings()");
    expect(source).toContain(denial);
    expect(source).toContain("Speichern (NOT_AVAILABLE)");
    const submitButton = source.match(/<button\b(?=[^>]*\btype\s*=\s*"submit")[^>]*>/)?.[0];
    expect(submitButton).toBeDefined();
    expect(submitButton).toMatch(/\sdisabled(?=\s|\/?>)/);
    expect(source).toMatch(/const handleSubmit = \(e: React\.FormEvent\) => \{\s+e\.preventDefault\(\);\s+\};/);
    expect(source).not.toContain("updateCompanySettings");
    expect(source).not.toMatch(/handleSubmit[\s\S]*?await/);
  });
});
