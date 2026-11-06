"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type {
  RecordGoodsOutInput,
  RecordGoodsOutResult,
} from "@/lib/server/commands/recordGoodsOutCommand";

function invoiceClientEventId(goodsOutClientEventId: string): string {
  const hash = createHash("sha256")
    .update(`absprache-invoice:${goodsOutClientEventId}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function recordGoodsOutAction(
  input: RecordGoodsOutInput,
): Promise<RecordGoodsOutResult> {
  if (input.agreement && input.agreement.type !== "sammelrechnung") {
    const { createInvoice } = await import("@/lib/server/commands/immutableInvoiceCommand");
    const invoice = await createInvoice({
      orderId: input.orderId,
      expectedVersion: input.expectedVersion,
      clientEventId: invoiceClientEventId(input.clientEventId),
      agreement: input.agreement,
    });
    if (invoice.code !== "OK") {
      return { code: invoice.code, message: invoice.message };
    }
  }
  const { recordGoodsOut } = await import("@/lib/server/commands/recordGoodsOutCommand");
  const result = await recordGoodsOut(input);
  if (result.code === "OK") {
    revalidatePath("/warendurchlauf");
    revalidatePath("/buchhaltung/rechnungen");
  }
  return result;
}
