"use server";

import { revalidatePath } from "next/cache";
import type {
  ConfirmPaymentInput,
  ConfirmPaymentResult,
} from "@/lib/server/commands/confirmPaymentCommand";

export async function confirmPaymentAction(
  input: ConfirmPaymentInput,
): Promise<ConfirmPaymentResult> {
  const { confirmPayment } = await import("@/lib/server/commands/confirmPaymentCommand");
  const result = await confirmPayment(input);
  if (result.code === "OK") {
    revalidatePath("/buchhaltung/rechnungen");
    revalidatePath("/cockpit");
    revalidatePath("/warendurchlauf");
  }
  return result;
}
