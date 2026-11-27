import { plusWorkingDays, workingDaysBetween } from "@/lib/domain/workingDays";
import { ORDER_TERM_COPY } from "@/ui/ordersCopy";

type AuftragsTermin = Readonly<{
  dueDate: string | null;
  handoverMode: "pickup" | "shipping" | null;
}>;

type TerminKalender = Readonly<{
  betriebsruhe: ReadonlySet<string> | null;
  versandpufferArbeitstage: number;
  knappAbArbeitstagen: number | null;
}>;

type FehlendeTerminEinstellung = "betriebsruhe" | "terminschwelle";

type TerminStand = Readonly<{
  fertigtermin: string | null;
  stufe: "im_plan" | "knapp" | "ueberfaellig" | "unbekannt";
  fehlendeEinstellungen?: readonly FehlendeTerminEinstellung[];
}>;

export function fertigtermin(auftrag: AuftragsTermin, kalender: TerminKalender, heute: string): TerminStand | null {
  if (!auftrag.dueDate || auftrag.handoverMode === null) return { fertigtermin: null, stufe: "unbekannt" };
  const { betriebsruhe, versandpufferArbeitstage, knappAbArbeitstagen } = kalender;
  const schwelleFehlt = knappAbArbeitstagen === null || !Number.isSafeInteger(knappAbArbeitstagen) || knappAbArbeitstagen < 0;
  if (betriebsruhe === null || schwelleFehlt) {
    const fehlendeEinstellungen: FehlendeTerminEinstellung[] = [];
    if (betriebsruhe === null) fehlendeEinstellungen.push("betriebsruhe");
    if (schwelleFehlt) fehlendeEinstellungen.push("terminschwelle");
    return { fertigtermin: null, stufe: "unbekannt", fehlendeEinstellungen };
  }
  if (auftrag.handoverMode === "shipping"
    && (!Number.isSafeInteger(versandpufferArbeitstage) || versandpufferArbeitstage < 0)) {
    return null;
  }
  const termin = auftrag.handoverMode === "shipping" && versandpufferArbeitstage > 0
    ? plusWorkingDays(auftrag.dueDate, -versandpufferArbeitstage, betriebsruhe)
    : auftrag.dueDate;
  if (termin === null) return null;
  const arbeitstage = workingDaysBetween(heute, termin, betriebsruhe);
  if (arbeitstage === null) return null;
  if (termin < heute) return { fertigtermin: termin, stufe: "ueberfaellig" };
  return { fertigtermin: termin, stufe: arbeitstage <= knappAbArbeitstagen ? "knapp" : "im_plan" };
}

const risikofarben = {ueberfaellig:'red', knapp:'orange', im_plan:'green', unbekannt:'unknown'} as const;
const datumDeutsch = new Intl.DateTimeFormat('de-DE', {dateStyle:'medium', timeZone:'UTC'});

export function zeigeFertigtermin(
  auftrag: AuftragsTermin, kalender: TerminKalender | null, heute: string, blocked: boolean,
  vorberechneterTermin = kalender && fertigtermin(auftrag, kalender, heute),
) {
  if (blocked) return {risk:'blocked' as const,...ORDER_TERM_COPY.blocked};
  const termin = vorberechneterTermin;
  const stufe = termin?.stufe ?? 'unbekannt';
  let dueValue: string = ORDER_TERM_COPY.notRecorded;
  const datum = termin?.fertigtermin;
  const fehlt = termin?.fehlendeEinstellungen;
  if (fehlt?.length) {
    const einstellung = fehlt.length === 2
      ? ORDER_TERM_COPY.settings.both
      : ORDER_TERM_COPY.settings[fehlt[0]];
    dueValue = ORDER_TERM_COPY.settingsMissing(einstellung);
  } else if (datum && kalender?.betriebsruhe) {
    const tage = workingDaysBetween(heute, datum, kalender.betriebsruhe);
    dueValue = datum===heute ? ORDER_TERM_COPY.dueToday
      : tage===null || tage===0 ? datumDeutsch.format(new Date(datum+'T00:00:00Z'))
      : tage>0 ? ORDER_TERM_COPY.dueIn(tage) : ORDER_TERM_COPY.overdueSince(-tage);
  }
  return {risk:risikofarben[stufe], statusText:ORDER_TERM_COPY.status[stufe], dueLabel:ORDER_TERM_COPY.label, dueValue};
}
