"use server";

import { readLagerEinstellungen, readLoggingSettings } from "@/modules/fundament/server-public";
import { readCustomerProfile } from "@/modules/customers/server-public";
import { recordIntakeTaskEffect } from "@/modules/eingang/server-public";
import { hinterlegeLagerPreis as speicherePreis, type LagerPreisAufgabe } from "@/modules/lager/server-public";
import { observeAction, subjectForAction } from "@/modules/logging/server-public";
import { synchronizeLagerPreisTask } from "@/modules/tasks/server-public";

const synchronisierePreisaufgabe: LagerPreisAufgabe = (tx, auth, artikelId, einheit, lesePreisstand) =>
  synchronizeLagerPreisTask(tx, auth, artikelId, einheit, {
    lesePreisstand,
    effect: (effectTx, akteur, aufgabe) => recordIntakeTaskEffect(effectTx, akteur, aufgabe, readCustomerProfile),
  });

export async function hinterlegeLagerPreis(input: unknown) {
  return observeAction("hinterlegeLagerPreis", subjectForAction("hinterlegeLagerPreis", input),
    () => speicherePreis(input, readLagerEinstellungen, synchronisierePreisaufgabe), readLoggingSettings);
}
