"use server";

import { readLagerEinstellungen, readLoggingSettings } from "@/modules/fundament/server-public";
import { observeAction, subjectForAction } from "@/modules/logging/server-public";
import {
  leseLagerInventurOriginal,
  leseLagerInventurVergleich,
  leseLagerInventurwerte,
  leseLagerInventurZaehlliste,
  schliesseLagerInventurAb,
  setzeLagerInventurGrund,
  speichereLagerInventurZaehlung,
  starteLagerInventur,
  starteLagerInventurNachtrag,
} from "@/modules/lager/server-public";

export async function starteLagerInventurAction(input: Parameters<typeof starteLagerInventur>[0]) {
  return observeAction("starteLagerInventurAction", subjectForAction("starteLagerInventurAction", input),
    () => starteLagerInventur(input), readLoggingSettings);
}

export async function leseLagerInventurZaehllisteAction(sessionId: string, ortId?: string) {
  return observeAction("leseLagerInventurZaehllisteAction", subjectForAction("leseLagerInventurZaehllisteAction", { sessionId }),
    () => leseLagerInventurZaehlliste(sessionId, ortId), readLoggingSettings);
}

export async function speichereLagerInventurZaehlungAction(input: unknown) {
  return observeAction("speichereLagerInventurZaehlungAction", subjectForAction("speichereLagerInventurZaehlungAction", input),
    () => speichereLagerInventurZaehlung(input), readLoggingSettings);
}

export async function leseLagerInventurwerteAction(sessionId: string) {
  return observeAction("leseLagerInventurwerteAction", subjectForAction("leseLagerInventurwerteAction", { sessionId }),
    () => leseLagerInventurwerte(sessionId, readLagerEinstellungen), readLoggingSettings);
}

export async function schliesseLagerInventurAbAction(input: Parameters<typeof schliesseLagerInventurAb>[0]) {
  return observeAction("schliesseLagerInventurAbAction", subjectForAction("schliesseLagerInventurAbAction", input),
    () => schliesseLagerInventurAb(input, readLagerEinstellungen), readLoggingSettings);
}

export async function starteLagerInventurNachtragAction(input: Parameters<typeof starteLagerInventurNachtrag>[0]) {
  return observeAction("starteLagerInventurNachtragAction", subjectForAction("starteLagerInventurNachtragAction", input),
    () => starteLagerInventurNachtrag(input), readLoggingSettings);
}

export async function leseLagerInventurOriginalAction(sessionId?: string, art?: "csv" | "pdf" | "xlsx") {
  return observeAction("leseLagerInventurOriginalAction", subjectForAction("leseLagerInventurOriginalAction", { sessionId }),
    () => leseLagerInventurOriginal(sessionId, art), readLoggingSettings);
}

export async function leseLagerInventurVergleichAction() {
  return observeAction("leseLagerInventurVergleichAction", subjectForAction("leseLagerInventurVergleichAction", undefined),
    () => leseLagerInventurVergleich(readLagerEinstellungen), readLoggingSettings);
}

export async function setzeLagerInventurGrundAction(input: Parameters<typeof setzeLagerInventurGrund>[0]) {
  return observeAction("setzeLagerInventurGrundAction", subjectForAction("setzeLagerInventurGrundAction", input),
    () => setzeLagerInventurGrund(input), readLoggingSettings);
}
