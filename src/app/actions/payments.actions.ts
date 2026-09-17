"use server";

import { revalidatePath } from "next/cache";
import {
  confirmPaymentCommand,
  readOrderPaymentStateCommand,
  readPaymentReceiptCommand,
  recoverPaymentConfirmationCommand,
  setPaymentModeCommand,
  type ConfirmPaymentInput,
  type ConfirmPaymentResult,
  type ReadOrderPaymentStateInput,
  type ReadPaymentReceiptInput,
  type RecoveryCommandInput,
  type SetPaymentModeInput,
  type SetPaymentModeResult,
} from "@/modules/accounting/server-public";

function revalidatePaymentConsumers(): void {
  revalidatePath("/buchhaltung/rechnungen");
  revalidatePath("/warendurchlauf");
}

export async function confirmPaymentAction(
  input: ConfirmPaymentInput,
): Promise<ConfirmPaymentResult> {
  const result = await confirmPaymentCommand(input);
  if (result.code === "OK") revalidatePaymentConsumers();
  return result;
}

export async function setPaymentModeAction(
  input: SetPaymentModeInput,
): Promise<SetPaymentModeResult> {
  const result = await setPaymentModeCommand(input);
  if (result.code === "OK") revalidatePaymentConsumers();
  return result;
}

export async function getOrderPaymentStateAction(input: ReadOrderPaymentStateInput) {
  return readOrderPaymentStateCommand(input);
}

export async function getPaymentReceiptAction(input: ReadPaymentReceiptInput) {
  return readPaymentReceiptCommand(input);
}

export async function recoverPaymentConfirmationAction(input: RecoveryCommandInput) {
  return recoverPaymentConfirmationCommand(input);
}
