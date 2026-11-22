import { equal, notEqual } from "node:assert/strict";
import { test } from "vitest";
import { istStammauftrag, stammAbsicht, type Stammbefehl } from "../stammbefehl";

const befehlId = "fbafe080-866d-4e91-a160-c291a07ab21a";
const datei = "dc93f593-c20b-4a2a-9425-0e088ef82666";
const pruefe = (daten: unknown) => istStammauftrag({ befehlId, daten });

test("Artikelentwurf braucht einen Namen oder eine Kennung eines vorhandenen Fotos", () => {
  equal(pruefe({ art: "artikel.entwurf", name: "TEST Fund", fotoId: null }), true);
  equal(pruefe({ art: "artikel.entwurf", name: null, fotoId: datei }), true);
  equal(pruefe({ art: "artikel.entwurf", name: null, fotoId: null }), false);
  equal(pruefe({ art: "artikel.entwurf", name: "TEST Fund", fotoId: "foto.jpg" }), false);
  equal(pruefe({ art: "artikel.entwurf", name: "TEST Fund", fotoId: null, tenantId: "fremd" }), false);
});

test("Anlage und Änderung verwenden disjunkte Kennungen und eine Vergleichsversion", () => {
  const rubrik = { art: "rubrik.speichern", id: null, version: 0, name: "TEST Rubrik" };
  equal(pruefe(rubrik), true);
  equal(pruefe({ ...rubrik, id: datei }), false);
  equal(pruefe({ ...rubrik, id: datei, version: 1 }), true);
  equal(pruefe({ ...rubrik, id: datei, version: NaN }), false);
  equal(pruefe({ ...rubrik, id: datei, version: 2147483647 }), false);
});

test("Gebinde bewahren Gültigkeitszeitpunkt, Maßeinheit und Beleg der Umrechnung", () => {
  const gebinde = { art: "gebinde.versionieren", artikelId: "TEST-Fund", schluessel: "TEST",
    version: 1, gebindeart: "Kanister", name: "TEST", menge: "20", einheit: "l",
    gueltigAb: "2026-11-21T08:00:00.000Z", umrechnung: null };
  equal(pruefe(gebinde), true);
  equal(pruefe({ ...gebinde, menge: "1.0001" }), false);
  equal(pruefe({ ...gebinde, menge: "1.5", einheit: "paar" }), false);
  equal(pruefe({ ...gebinde, gueltigAb: "2026-11-31T08:00:00.000Z" }), false);
  equal(pruefe({ ...gebinde, umrechnung: { menge: "18.500", einheit: "kg", belegId: datei } }), true);
  equal(pruefe({ ...gebinde, umrechnung: { menge: "18.500", einheit: "kg" } }), false);
});

test("Metallstamm lässt ungeprüfte Einstufung offen und begrenzt den Feingehalt", () => {
  const metall = { art: "artikel.metall", id: "TEST-Fund", version: 1, metall: "TEST Metall", feinPct: "25.5",
    kursMetall: true, paragraph13bMetall: null };
  equal(pruefe(metall), true);
  equal(pruefe({ ...metall, feinPct: "100.1" }), false);
  equal(pruefe({ ...metall, metall: null }), false);
});

test("Identische Eingaben ergeben dieselbe Absicht, auch bei umgekehrter Feldreihenfolge", () => {
  const a: Stammbefehl = { art: "artikel.entwurf", name: "TEST Fund", fotoId: null };
  const b: Stammbefehl = { fotoId: null, name: "TEST Fund", art: "artikel.entwurf" };
  equal(stammAbsicht(a), stammAbsicht(b));
  notEqual(stammAbsicht(a), stammAbsicht({ ...b, name: "TEST Anderer Fund" }));
});

test("Foto-Zuordnung verändert ausschließlich eine bestätigte Artikelidentität", () => {
  const daten = { art: "artikel.foto_zuordnen", id: "TEST-Fund", version: 2, fotoId: datei };
  equal(pruefe(daten), true);
  equal(pruefe({ ...daten, version: 0 }), false);
  equal(pruefe({ ...daten, roherOCRText: "TEST Keine zweite Ablage" }), false);
});

test("Lieferantenkennung erfordert eine Lieferanten-ID, QR und Synonym bleiben betriebsspezifisch", () => {
  const daten = { art: "artikel.kennung", id: "TEST-Fund", version: 2, kennungsart: "lieferant",
    lieferantId: "TEST-Lieferant", wert: "TEST-123" };
  equal(pruefe(daten), true);
  equal(pruefe({ ...daten, lieferantId: null }), false);
  equal(pruefe({ ...daten, kennungsart: "qr" }), false);
  equal(pruefe({ ...daten, kennungsart: "qr", lieferantId: null }), true);
});

test("Etikettenzuordnung führt Eingang und Original in derselben Befehlsabsicht", () => {
  const daten = { art: "artikel.foto_zuordnen", id: "TEST-Fund", version: 2, fotoId: datei } as const;
  const eingangId = "5f6a8222-e072-4547-8e3a-b7b7bc6f6bfc";
  equal(pruefe({ ...daten, eingangId }), true);
  equal(pruefe({ ...daten, eingangId: undefined }), false);
  equal(pruefe({ ...daten, eingangId: "TEST-keine-UUID" }), false);
  notEqual(stammAbsicht(daten), stammAbsicht({ ...daten, eingangId }));
});
