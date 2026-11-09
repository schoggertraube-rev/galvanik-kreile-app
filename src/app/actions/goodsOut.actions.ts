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
  const { authorizeGoodsOutInput, recordGoodsOut } = await import("@/lib/server/commands/recordGoodsOutCommand");
  // Validate and authorize before the composed invoice writer can change data.
  const authorized = await authorizeGoodsOutInput(input);
  if (authorized.code !== "AUTHORIZED") return authorized;
  const invoiceInput=input.agreement&&input.agreement.type!=='sammelrechnung'?{
    orderId:input.orderId,expectedVersion:input.expectedVersion,
    clientEventId:invoiceClientEventId(input.clientEventId),agreement:input.agreement,
  }:null;
  const invoicePort=invoiceInput?await import("@/lib/server/commands/immutableInvoiceCommand"):null;
  const result = await recordGoodsOut(input,invoiceInput&&invoicePort?{
    beforeOrderLock:(tx,auth)=>invoicePort.lockInvoiceCreation(tx,auth.tenantId,invoiceInput),
    beforeWrite:async tx=>{
      const invoice=await invoicePort.createInvoice(invoiceInput,tx);
      return invoice.code==='OK'?null:{code:invoice.code,message:invoice.message};
    },
  }:undefined);
  if (result.code === "OK") {
    revalidatePath("/");
    revalidatePath("/warendurchlauf");
    revalidatePath("/buchhaltung/rechnungen");
  }
  return result;
}
