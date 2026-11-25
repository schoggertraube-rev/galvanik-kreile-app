"use server";

import { readLagerEinstellungen, readLoggingSettings } from "@/modules/fundament/server-public";
import { observeAction, subjectForAction } from "@/modules/logging/server-public";
import {
  bestaetigeLagerEtikettZuordnung,
  bucheAuftragsverbrauch,
  bucheLagerEinzeln,
  bucheLagerGegenbuchung,
  leseLagerArtikelAltvertrag,
  leseLagerBefehlsstand,
  leseLagerBewegungenAltvertrag,
  speichereLagerStammdaten,
  type LagerBewegungssuche,
  type LagerTaskPorts,
} from "@/modules/lager/server-public";
import { synchronizeLagerBestandTask, synchronizeLagerEntwurfTask } from "@/modules/tasks/server-public";

const taskPorts: LagerTaskPorts = {
  synchronize: (tx, auth, sourceId, effect) =>
    synchronizeLagerEntwurfTask(tx, auth, sourceId, { effect }),
};

export async function speichereLagerStammdatenAction(input: unknown) {
  return observeAction("speichereLagerStammdatenAction", subjectForAction("speichereLagerStammdatenAction", input),
    () => speichereLagerStammdaten(input, taskPorts), readLoggingSettings);
}

export async function bestaetigeLagerEtikettZuordnungAction(input: unknown) {
  return observeAction("bestaetigeLagerEtikettZuordnungAction", subjectForAction("bestaetigeLagerEtikettZuordnungAction", input),
    () => bestaetigeLagerEtikettZuordnung(input, taskPorts), readLoggingSettings);
}

export async function bucheLagerAction(input: unknown) {
  return observeAction("bucheLagerAction", subjectForAction("bucheLagerAction", input),
    () => bucheLagerEinzeln(input, readLagerEinstellungen, synchronizeLagerBestandTask), readLoggingSettings);
}

export async function bucheLagerGegenbuchungAction(input: unknown) {
  return observeAction("bucheLagerGegenbuchungAction", subjectForAction("bucheLagerGegenbuchungAction", input),
    () => bucheLagerGegenbuchung(input, readLagerEinstellungen, synchronizeLagerBestandTask), readLoggingSettings);
}

export async function bucheAuftragsverbrauchAction(input: unknown) {
  return observeAction("bucheAuftragsverbrauchAction", subjectForAction("bucheAuftragsverbrauchAction", input),
    () => bucheAuftragsverbrauch(input, readLagerEinstellungen, synchronizeLagerBestandTask), readLoggingSettings);
}

export async function leseLagerBestandAction(artikelId?: string) {
  return observeAction("leseLagerBestandAction", subjectForAction("leseLagerBestandAction", { artikelId }),
    () => leseLagerArtikelAltvertrag(artikelId), readLoggingSettings);
}

export async function leseLagerBewegungenAction(suche?: LagerBewegungssuche) {
  return observeAction("leseLagerBewegungenAction", subjectForAction("leseLagerBewegungenAction", suche),
    () => leseLagerBewegungenAltvertrag(suche), readLoggingSettings);
}

export async function leseLagerBefehlsstandAction(befehlIds: readonly string[]) {
  return observeAction("leseLagerBefehlsstandAction", subjectForAction("leseLagerBefehlsstandAction", befehlIds),
    () => leseLagerBefehlsstand(befehlIds), readLoggingSettings);
}
