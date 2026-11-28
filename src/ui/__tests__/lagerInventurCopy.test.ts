import { describe, expect, it } from "vitest";
import { LAGER_INVENTUR_COPY } from "../lagerInventurCopy";

describe("Lager-Inventur-Texte", () => {
  it("hält die fachlichen Fehlertexte für Inventur und Nachtrag zentral", () => {
    expect(LAGER_INVENTUR_COPY.abgeschlossen).toBe("Verwende für den abgeschlossenen Stichtag einen Nachtrag.");
    expect(LAGER_INVENTUR_COPY.bewegungSeitZaehlung).toBe("Öffne die neue Bewegung und zähl den betroffenen Bestand erneut.");
    expect(LAGER_INVENTUR_COPY.nachtragGrund).toBe("Trag den Grund für den Nachtrag ein.");
  });

  it("stellt Vergleichstexte nur über den Lager-Inventur-Katalog bereit", () => {
    expect(LAGER_INVENTUR_COPY.vergleich).toMatchObject({
      titel: "Bestand und letzte Zählung",
      soll: "Buchbestand",
      gezaehlt: "Letzte Zählung",
      teilzaehlung: "Zählung unvollständig",
    });
  });
});
