import { expect, test } from "vitest";
import { berechneNichtBerechneteMehrarbeit, freigabeDecktPosition, leseMehrarbeitsfreigabe, verteileMehrarbeit } from "../mehrarbeitSpielraum";

const frueh = "2026-11-23T08:00:00.000000Z";
const spaet = "2026-11-23T08:00:00.000001Z";

test("Zeitpositionen teilen den Spielraum nach Buchungszeit und bei Gleichstand nach ID", () => {
  const ergebnis = verteileMehrarbeit([
    { id: "c", buchungsId: "c", version: 1, gebuchtAm: spaet, minuten: 2, stundensatzCent: 6000 },
    { id: "b", buchungsId: "b", version: 1, gebuchtAm: frueh, minuten: 2, stundensatzCent: 7200 },
    { id: "a", buchungsId: "a", version: 1, gebuchtAm: frueh, minuten: 7, stundensatzCent: 7200 },
  ], 100_000, 100, 130);

  expect(ergebnis).toEqual({
    spielraumCent: 1000,
    stoppCent: 1300,
    ueberStopp: false,
    ueberSpielraum: true,
    positionen: [
      { position: { id: "a", buchungsId: "a", version: 1, gebuchtAm: frueh, minuten: 7, stundensatzCent: 7200 }, bestaetigteMinuten: 0, bestaetigterBetragCent: 0, abrechenbareMinuten: 7, betragCent: 840, nichtAbgerechnetMinuten: 0, nachkalkulationCent: 0 },
      { position: { id: "b", buchungsId: "b", version: 1, gebuchtAm: frueh, minuten: 2, stundensatzCent: 7200 }, spielraumGekappt: true, bestaetigteMinuten: 0, bestaetigterBetragCent: 0, abrechenbareMinuten: 1, betragCent: 120, nichtAbgerechnetMinuten: 1, nachkalkulationCent: 120 },
      { position: { id: "c", buchungsId: "c", version: 1, gebuchtAm: spaet, minuten: 2, stundensatzCent: 6000 }, bestaetigteMinuten: 0, bestaetigterBetragCent: 0, abrechenbareMinuten: 0, betragCent: 0, nichtAbgerechnetMinuten: 2, nachkalkulationCent: 200 },
    ],
  });
});

test("Ohne belegten Grundbetrag bleiben alle Minuten in der Nachkalkulation", () => {
  expect(verteileMehrarbeit([
    { id: "a", buchungsId: "a", version: 1, gebuchtAm: frueh, minuten: 1, stundensatzCent: 6019 },
  ], 0, 100, 130).positionen[0]).toMatchObject({
    abrechenbareMinuten: 0, betragCent: 0, nichtAbgerechnetMinuten: 1, nachkalkulationCent: 100,
  });
});

test("Der Ausgang zieht getrennt berechnete Minuten derselben Position vom gebuchten Aufwand ab", () => {
  const schluessel = { itemId: "teil", catalogPositionId: "arbeit" };
  const gebucht = [{ ...schluessel, id: "a", buchungsId: "a", version: 1, gebuchtAm: frueh, minuten: 4, stundensatzCent: 6031 }];
  const zeile = { ...schluessel, minutes: 1, hourlyRateCents: 6031 };
  expect(berechneNichtBerechneteMehrarbeit(gebucht, [zeile, zeile])).toEqual({ minuten: 2, betragCent: 201 });
  expect(() => berechneNichtBerechneteMehrarbeit(gebucht, [{ ...zeile, minutes: 5 }]))
    .toThrow("ORDER_EXTRA_WORK_INVOICE_SOURCE_INVALID");
});

test("Die Stoppgrenze zählt den gesamten gebuchten Betrag auch bei gekappter Rechnung", () => {
  const position = { id: "a", buchungsId: "a", version: 1, gebuchtAm: frueh, minuten: 10, stundensatzCent: 6_000 };
  expect(verteileMehrarbeit([position], 100_000, 50, 100))
    .toMatchObject({ ueberSpielraum: true, ueberStopp: false });
  expect(verteileMehrarbeit([{ ...position, minuten: 11 }], 100_000, 50, 100))
    .toMatchObject({ ueberSpielraum: true, ueberStopp: true });
});

const freigegebeneZeitposition = { lineId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", lineVersion: 2 };
const kundenfreigabe = {
  approvedNetAmountCents: 1500,
  positions: [freigegebeneZeitposition],
  channel: "telefon" as const,
  approvedAt: "2026-11-23T08:00:00.000Z",
  approvedBy: "TEST Kunde",
  confirmationText: "TEST: Ich bestätige die genannten Minuten.",
};

test("Die Freigabe belegt genau die bestätigte Version einer Zeitposition", () => {
  const freigabe = leseMehrarbeitsfreigabe(kundenfreigabe);
  expect(freigabe).toEqual(kundenfreigabe);
  if (!freigabe) throw Error("TEST_MEHRARBEITSFREIGABE_FEHLT");
  expect(freigabeDecktPosition(freigabe, freigegebeneZeitposition)).toBe(true);
  expect(freigabeDecktPosition(freigabe, { ...freigegebeneZeitposition, lineVersion: 3 })).toBe(false);
});

test("Die Freigabe braucht einen Betrag und eindeutige Zeitpositionen mit Version", () => {
  expect(leseMehrarbeitsfreigabe({ ...kundenfreigabe, approvedNetAmountCents: -1 })).toBeNull();
  expect(leseMehrarbeitsfreigabe({ ...kundenfreigabe, positions: [
    freigegebeneZeitposition, { ...freigegebeneZeitposition, lineVersion: 3 },
  ] })).toBeNull();
  expect(leseMehrarbeitsfreigabe({ ...kundenfreigabe, confirmationText: " " })).toBeNull();
});

test("Teilfreigaben werden je Position höchstens einmal und nur für die belegte Version angerechnet", () => {
  const zweite = { lineId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", lineVersion: 1 };
  const alte = { lineId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", lineVersion: 1 };
  const ergebnis = verteileMehrarbeit([
    { id: zweite.lineId, buchungsId: zweite.lineId, version: 1, gebuchtAm: frueh, minuten: 3, stundensatzCent: 6000 },
    { id: freigegebeneZeitposition.lineId, buchungsId: freigegebeneZeitposition.lineId, version: 2, gebuchtAm: frueh, minuten: 2, stundensatzCent: 6031 },
    { id: alte.lineId, buchungsId: alte.lineId, version: 2, gebuchtAm: spaet, minuten: 2, stundensatzCent: 5940 },
  ], 50_000, 100, 130, [
    { ...kundenfreigabe, eventId: "zusage-1", approvedNetAmountCents: 302, positions: [zweite, freigegebeneZeitposition] },
    { ...kundenfreigabe, eventId: "zusage-2", approvedNetAmountCents: 250, positions: [zweite] },
    { ...kundenfreigabe, eventId: "zusage-alt", approvedNetAmountCents: 500, positions: [alte] },
  ]);

  expect(ergebnis.positionen).toMatchObject([
    { bestaetigteMinuten: 2, bestaetigterBetragCent: 201, abrechenbareMinuten: 2, betragCent: 201, nachkalkulationCent: 0 },
    { bestaetigteMinuten: 2, bestaetigterBetragCent: 200, abrechenbareMinuten: 2, betragCent: 200, nachkalkulationCent: 100 },
    { bestaetigteMinuten: 0, bestaetigterBetragCent: 0, abrechenbareMinuten: 1, betragCent: 99, nachkalkulationCent: 99 },
  ]);
});

test("Eine Freigabe oberhalb des Spielraums reicht nur für ganze Minuten der belegten Position", () => {
  const ergebnis = verteileMehrarbeit([
    { id: freigegebeneZeitposition.lineId, buchungsId: freigegebeneZeitposition.lineId, version: 2, gebuchtAm: frueh, minuten: 2, stundensatzCent: 6031 },
    { id: "neu", buchungsId: "neu", version: 1, gebuchtAm: spaet, minuten: 1, stundensatzCent: 6000 },
  ], 8_000, 100, 130, [
    { ...kundenfreigabe, eventId: "zusage", approvedNetAmountCents: 100 },
  ]);

  expect(ergebnis.positionen).toMatchObject([
    { zusageEventId: "zusage", bestaetigteMinuten: 1, bestaetigterBetragCent: 100, betragCent: 100, nachkalkulationCent: 100 },
    { bestaetigteMinuten: 0, abrechenbareMinuten: 0, betragCent: 0, nachkalkulationCent: 100 },
  ]);
});
