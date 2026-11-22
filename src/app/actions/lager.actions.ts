"use server";

import {
  speichereLagerStammdaten,
  bestaetigeLagerEtikettZuordnung,
  type LagerTaskPorts,
} from "@/modules/lager/server-public";
import { synchronizeLagerEntwurfTask } from "@/modules/tasks/server-public";

// Existing writers and transaction remain authoritative. The client supplies
// only the command, never an actor, callback, task writer or dependency.
const taskPorts: LagerTaskPorts = {
  synchronize: (tx, auth, sourceId, effect) =>
    synchronizeLagerEntwurfTask(tx, auth, sourceId, { effect }),
};

export async function speichereLagerStammdatenAction(input: unknown) {
  return speichereLagerStammdaten(input, taskPorts);
}

export async function bestaetigeLagerEtikettZuordnungAction(input: {
  befehlId: string; eingangId: string; fotoId: string; artikelId: string; version: number;
}) {
  return bestaetigeLagerEtikettZuordnung(input, taskPorts);
}
