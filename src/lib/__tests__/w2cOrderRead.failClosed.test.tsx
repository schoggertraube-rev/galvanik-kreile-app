import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getOrderWithDetails, ORDER_DETAIL_READ_NOT_AVAILABLE_MESSAGE } from "../repositories/orderQueries";
import { useOrderLive } from "../useOrderLive";

function HookProbe() {
  const result = useOrderLive("foreign-order");
  return <output data-testid="order-live-probe">{JSON.stringify(result)}</output>;
}

describe("W2C-B2M5O order read fail-closed containment", () => {
  it("returns null for every order ID without a database, authorization, or console port", async () => {
    const consoleSpy = vi.spyOn(console, "error");
    await expect(getOrderWithDetails("foreign-order")).resolves.toBeNull();
    await expect(getOrderWithDetails("another-order")).resolves.toBeNull();
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("returns the stable denial snapshot during a real component render", () => {
    render(<HookProbe />);
    const result = JSON.parse(screen.getByTestId("order-live-probe").textContent ?? "{}") as Record<string, unknown>;
    expect(result).toMatchObject({
      orderData: null,
      loading: false,
      error: ORDER_DETAIL_READ_NOT_AVAILABLE_MESSAGE,
      denial: ORDER_DETAIL_READ_NOT_AVAILABLE_MESSAGE,
    });
  });

  it("contains no runtime read, realtime, hook, or client ports", async () => {
    const [querySource, hookSource] = await Promise.all([readFile(resolve(process.cwd(), "src/lib/repositories/orderQueries.ts"), "utf8"), readFile(resolve(process.cwd(), "src/lib/useOrderLive.ts"), "utf8")]);
    const queryRuntimeSource = querySource.replace(/^import type .+;$/gm, "");
    expect(querySource).toMatch(/Promise<OrderDetails \| null>/);
    expect(querySource).toMatch(/void orderId;[\s\S]*return null;/);
    expect(queryRuntimeSource).not.toMatch(/\bdb\b|drizzle|auth|console|import\s*\(|createClient|supabase|channel|\.on\(|subscribe|removeChannel/);
    expect(hookSource).not.toMatch(/getOrderWithDetails|useEffect|useState|supabase|channel|\.on\(|subscribe|removeChannel/);
  });
});
