import "server-only";

import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import {
  leseLagerMetallkurs,
  leseLagerMetallstamm,
  type MetallkursSuche,
} from "./server/stammdatenLesen";

// Innerhalb einer bestehenden Fachtransaktion. Die Aufrufer prüfen ihre
// Fachrechte und projizieren nur die für den jeweiligen Anlass erlaubten Daten.
export function readMetallstammInTransaction(
  tx: PrivilegedTenantTransaction,
  mandant: string,
  artikelId: string,
) {
  return leseLagerMetallstamm(tx, mandant, artikelId);
}

export function readMetallkursInTransaction(
  tx: PrivilegedTenantTransaction,
  mandant: string,
  suche: MetallkursSuche,
) {
  return leseLagerMetallkurs(tx, mandant, suche);
}
