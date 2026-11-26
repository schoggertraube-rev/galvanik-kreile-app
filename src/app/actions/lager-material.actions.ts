"use server";

import { readLoggingSettings } from "@/modules/fundament/server-public";
import { leseAuftragsmaterial as leseMaterial } from "@/modules/lager/server-public";
import { observeAction, subjectForAction } from "@/modules/logging/server-public";

export async function leseAuftragsmaterial(auftragId: string) {
  return observeAction("leseAuftragsmaterial", subjectForAction("leseAuftragsmaterial", { orderId: auftragId }),
    () => leseMaterial(auftragId), readLoggingSettings);
}
