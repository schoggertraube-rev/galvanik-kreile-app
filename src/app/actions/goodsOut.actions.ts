"use server";

import { revalidatePath } from "next/cache";
import type {
  RecordGoodsOutInput,
  RecordGoodsOutResult,
} from "@/lib/server/commands/recordGoodsOutCommand";

export async function recordGoodsOutAction(
  input: RecordGoodsOutInput,
): Promise<RecordGoodsOutResult> {
  const { recordGoodsOut } = await import("@/lib/server/commands/recordGoodsOutCommand");
  const result = await recordGoodsOut(input);
  if (result.code === "OK") {
    revalidatePath("/warendurchlauf");
    revalidatePath("/buchhaltung/rechnungen");
  }
  return result;
}
