import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  confirmPayment: vi.fn(),
  revalidatePath: vi.fn(),
  setPaymentMode: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: ports.revalidatePath }));
vi.mock("@/lib/server/commands/confirmPaymentCommand", () => ({
  confirmPayment: ports.confirmPayment,
}));
vi.mock("@/lib/server/commands/setPaymentModeCommand", () => ({
  setPaymentMode: ports.setPaymentMode,
}));

const confirmInput = {
  invoiceId: "11111111-1111-4111-8111-111111111111",
  amount: 1_000,
  method: "ueberweisung" as const,
  expectedVersion: 0,
  clientEventId: "22222222-2222-4222-8222-222222222222",
};

const modeInput = {
  orderId: "f15-payment-action-order",
  paymentMode: "rechnung" as const,
  expectedVersion: 0,
  clientEventId: "33333333-3333-4333-8333-333333333333",
};

describe("F1.5 payment server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("delegates exact inputs and revalidates payment consumers only after command success", async () => {
    ports.confirmPayment.mockResolvedValueOnce({ code: "OK", receipt: {}, replayed: false });
    ports.setPaymentMode.mockResolvedValueOnce({ code: "OK", receipt: {}, replayed: false });
    const { confirmPaymentAction, setPaymentModeAction } = await import("../payments.actions");

    await confirmPaymentAction(confirmInput);
    await setPaymentModeAction(modeInput);

    expect(ports.confirmPayment).toHaveBeenCalledWith(confirmInput);
    expect(ports.setPaymentMode).toHaveBeenCalledWith(modeInput);
    expect(ports.revalidatePath.mock.calls).toEqual([
      ["/buchhaltung/rechnungen"], ["/cockpit"], ["/warendurchlauf"],
      ["/buchhaltung/rechnungen"], ["/cockpit"], ["/warendurchlauf"],
    ]);
  });

  it("does not revalidate for any data-free command failure", async () => {
    ports.confirmPayment.mockResolvedValueOnce({ code: "CONFLICT", message: "stale" });
    ports.setPaymentMode.mockResolvedValueOnce({ code: "FORBIDDEN", message: "denied" });
    const { confirmPaymentAction, setPaymentModeAction } = await import("../payments.actions");

    await confirmPaymentAction(confirmInput);
    await setPaymentModeAction(modeInput);

    expect(ports.revalidatePath).not.toHaveBeenCalled();
  });
});
