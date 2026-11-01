"use server";

import {
  erfasseAuftragAusEingangCommand,
  type ErfasseAuftragResult,
} from "@/modules/eingang/server-public";

export async function erfasseAuftragAusEingangAction(input: unknown): Promise<ErfasseAuftragResult> {
  return erfasseAuftragAusEingangCommand(input);
}
