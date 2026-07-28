import { describe, expect, it } from "vitest";
import { isW3DraftAllowed, type W3DraftRequest } from "../w3RoleMatrixDraft";

const request = (overrides: Partial<W3DraftRequest>): W3DraftRequest => ({
  roles: ["werkstatt"],
  sameTenant: true,
  explicitlyAssignedWorkItem: true,
  resource: "work_item",
  action: "start",
  ...overrides,
});

describe("W3 role-matrix policy draft", () => {
  it("allows workshop work only for an explicitly assigned item in its tenant", () => {
    expect(isW3DraftAllowed(request({ action: "complete" }))).toBe(true);
    expect(isW3DraftAllowed(request({ explicitlyAssignedWorkItem: false }))).toBe(false);
    expect(isW3DraftAllowed(request({ sameTenant: false }))).toBe(false);
  });

  it("does not turn admin into an operational or financial superuser", () => {
    expect(isW3DraftAllowed(request({ roles: ["admin"], resource: "roles", action: "manage" }))).toBe(true);
    expect(isW3DraftAllowed(request({ roles: ["admin"], resource: "finance", action: "read" }))).toBe(false);
    expect(isW3DraftAllowed(request({ roles: ["admin"], resource: "work_item", action: "complete" }))).toBe(false);
  });

  it("keeps unowned specialties and batch handling denied", () => {
    expect(isW3DraftAllowed(request({ roles: ["readonly"], resource: "customer", action: "read" }))).toBe(false);
    expect(isW3DraftAllowed(request({ roles: ["meister"], resource: "batch", action: "update" }))).toBe(false);
    expect(isW3DraftAllowed(request({ roles: ["photo_ocr_ai"], resource: "photo_ocr_ai", action: "create" }))).toBe(false);
  });
});
