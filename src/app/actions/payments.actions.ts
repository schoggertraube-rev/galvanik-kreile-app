"use server";

import { revalidatePath } from "next/cache";
import type {
  ConfirmPaymentInput,
  ConfirmPaymentResult,
} from "@/lib/server/commands/confirmPaymentCommand";
import type {
  SetPaymentModeInput,
  SetPaymentModeResult,
} from "@/lib/server/commands/setPaymentModeCommand";

function revalidatePaymentConsumers(): void {
  revalidatePath("/buchhaltung/rechnungen");
  revalidatePath("/cockpit");
  revalidatePath("/warendurchlauf");
}

export async function confirmPaymentAction(
  input: ConfirmPaymentInput,
): Promise<ConfirmPaymentResult> {
  const { confirmPayment } = await import("@/lib/server/commands/confirmPaymentCommand");
  const result = await confirmPayment(input);
  if (result.code === "OK") {
    revalidatePaymentConsumers();
  }
  return result;
}

export async function setPaymentModeAction(
  input: SetPaymentModeInput,
): Promise<SetPaymentModeResult> {
  const { setPaymentMode } = await import("@/lib/server/commands/setPaymentModeCommand");
  const result = await setPaymentMode(input);
  if (result.code === "OK") {
    revalidatePaymentConsumers();
  }
  return result;
}
