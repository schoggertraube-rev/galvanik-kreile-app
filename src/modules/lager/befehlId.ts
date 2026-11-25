import { createHash } from "node:crypto";

/** Stabile Befehls-ID für wiederholte V20-Operationen und ihre Positionszeilen. */
export function lagerBefehlId(operationId: string, index = 0): string {
  if (!Number.isInteger(index) || index < 0) throw new RangeError("LAGER_BEFEHL_INDEX_UNGUELTIG");
  const hash = createHash("sha256").update(`lager-befehl:${operationId}:${index}`).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20)}`;
}
