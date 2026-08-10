import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFile(path.resolve(process.cwd(), "src/app/actions/inquiries.actions.ts"), "utf8");

const expectedActionSource = [
  '"use server";',
  "",
  'import type { QuoteRequest } from "@/lib/repositories/inquiriesRepository";',
  "",
  "export async function getInquiries(): Promise<QuoteRequest[]> {",
  '  throw new Error("NOT_AVAILABLE: Sicherer W3-Read-Vertrag fehlt.");',
  "}",
  "",
  "export async function getOpenInquiriesCount(): Promise<number> {",
  '  throw new Error("NOT_AVAILABLE: Sicherer W3-Read-Vertrag fehlt.");',
  "}",
  "",
  "export async function createInquiry(data: Record<string, unknown>) {",
  "  void data;",
  '  return { success: false, error: "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt." };',
  "}",
  "",
  "export async function updateInquiry(id: string, changes: Partial<QuoteRequest>): Promise<QuoteRequest | null> {",
  "  void id;",
  "  void changes;",
  "  return null;",
  "}",
  "",
].join("\n");

describe("inquiries actions W2C fail-closed contract", () => {
  it("contains only the type import and the four concrete denial bodies", async () => {
    await expect(source()).resolves.toBe(expectedActionSource);
  });

  it("denies reads with the exact W3-contract error", async () => {
    const { getInquiries, getOpenInquiriesCount } = await import("@/app/actions/inquiries.actions");

    await expect(getInquiries()).rejects.toThrow("NOT_AVAILABLE: Sicherer W3-Read-Vertrag fehlt.");
    await expect(getOpenInquiriesCount()).rejects.toThrow("NOT_AVAILABLE: Sicherer W3-Read-Vertrag fehlt.");
  });

  it("denies create with the exact W3-contract result", async () => {
    const { createInquiry } = await import("@/app/actions/inquiries.actions");

    await expect(createInquiry({ customerName: "x" })).resolves.toEqual({
      success: false,
      error: "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.",
    });
  });

  it("returns null for updates", async () => {
    const { updateInquiry } = await import("@/app/actions/inquiries.actions");

    await expect(updateInquiry("inquiry-id", { status: "offen" })).resolves.toBeNull();
  });
});
