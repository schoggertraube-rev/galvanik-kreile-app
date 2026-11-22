import "server-only";

import { istArbeitstag, istBetriebsruhe, validierterBetriebskalender,
  type Betriebskalender } from "@/lib/domain/workingDays";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { readBetriebsruheInTransaction } from "./s16dSpurDSettingsPort";

export async function readArbeitskalenderInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string,
  quelle: Omit<Betriebskalender, "betriebsruhe"> | null,
) {
  if (!quelle) return null;
  const { betriebsruhe, versandpufferArbeitstage } = await readBetriebsruheInTransaction(tx, tenantId);
  if (!Array.isArray(betriebsruhe) || !betriebsruhe.every(istBetriebsruhe)) return null;
  const stand = { ...quelle, betriebsruhe };
  if (!validierterBetriebskalender(stand)) return null;
  return { stand, gueltigAb: stand.gueltigAb, versandpufferArbeitstage,
    istArbeitstag: (datum: string) => istArbeitstag(datum, stand) };
}
