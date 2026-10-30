"use server";

import { revalidatePath } from "next/cache";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type {
  ConfirmPaymentInput,
  ConfirmPaymentResult,
} from "@/lib/server/commands/confirmPaymentCommand";
import type {
  SetPaymentModeInput,
  SetPaymentModeResult,
} from "@/lib/server/commands/setPaymentModeCommand";
import type {
  OrderPaymentStateReadResult,
} from "@/lib/server/paymentSummaryRead";

type ActionAuthorizationResult =
  | { ok: true; data: AuthorizationSnapshot }
  | { ok: false; result: { code: "UNAUTHENTICATED" | "UNAVAILABLE"; message: string } };

async function resolveActionAuthorization(): Promise<ActionAuthorizationResult> {
  const { resolveAuthorization } = await import("@/lib/server/authorization");
  const authorization = await resolveAuthorization().catch((error: unknown) => {
    console.error("[ORDER_CARD_PAYMENT_AUTHORIZATION_ERROR]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return null;
  });
  if (!authorization || (!authorization.ok && authorization.reason === "AUTHORIZATION_UNAVAILABLE")) {
    return {
      ok: false,
      result: { code: "UNAVAILABLE", message: "Zahlungsdaten konnten nicht sicher geladen werden." },
    };
  }
  if (!authorization.ok) {
    return {
      ok: false,
      result: { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." },
    };
  }
  return { ok: true, data: authorization.data };
}

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
  if (result.code === "OK") revalidatePaymentConsumers();
  return result;
}

export async function setPaymentModeAction(
  input: SetPaymentModeInput,
): Promise<SetPaymentModeResult> {
  const { setPaymentMode } = await import("@/lib/server/commands/setPaymentModeCommand");
  const result = await setPaymentMode(input);
  if (result.code === "OK") revalidatePaymentConsumers();
  return result;
}

export type GetOrderPaymentStateActionResult =
  | OrderPaymentStateReadResult
  | { code: "UNAUTHENTICATED"; message: string };

export async function getOrderPaymentStateAction(
  input: { orderId: string },
): Promise<GetOrderPaymentStateActionResult> {
  try {
    const authorization = await resolveActionAuthorization();
    if (!authorization.ok) return authorization.result;
    const { getPaymentState } = await import("@/lib/server/paymentSummaryRead");
    return getPaymentState(authorization.data, input.orderId);
  } catch (error) {
    console.error("[ORDER_CARD_PAYMENT_ACTION_ERROR]", {
      orderId: input.orderId,
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return { code: "UNAVAILABLE", message: "Zahlungsdaten konnten nicht sicher geladen werden." };
  }
}
