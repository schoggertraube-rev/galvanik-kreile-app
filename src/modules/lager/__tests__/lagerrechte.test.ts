import { strict as assert } from "node:assert";
import { equal, notEqual, deepEqual, throws } from "node:assert/strict";
import { test } from "vitest";
import { hasLagerCapability, type AppRole } from "@/lib/auth/authorizationContract";
import { countLagerPackageGroups, countLagerPackages } from "../quantity";
import { istStammauftrag, stammAbsicht, type Stammbefehl } from "../stammbefehl";

// Unchanged approved P1 cases: lagerrechte.test.ts


test("Lagerstammdaten folgen dem Loginrecht und seinem Standard je Rolle", () => {
  const erwartung: [AppRole, boolean][] = [
    ["admin", true], ["buero", true], ["meister", false],
    ["werkstatt", false], ["readonly", false], ["developer", false],
  ];
  for (const [role, darfSchreiben] of erwartung) {
    assert.equal(hasLagerCapability({ role, active: true }, "lager.stamm"), darfSchreiben, role);
  }
  assert.equal(hasLagerCapability({ role: "admin", active: true, areas: [] }, "lager.stamm"), false);
  assert.equal(hasLagerCapability({ role: "buero", active: true, areas: [] }, "lager.stamm"), false);
  assert.equal(hasLagerCapability({ role: "meister", active: true, areas: ["lager.stamm"] }, "lager.stamm"), true);
  assert.equal(hasLagerCapability({ role: "readonly", active: true, areas: ["lager.stamm"] }, "lager.stamm"), false);
  assert.equal(hasLagerCapability({ role: "admin", active: false, areas: ["lager.stamm"] }, "lager.stamm"), false);
});

test("Lagerlesen, Werkstattentwurf und Wertsicht haben verschiedene Rechte", () => {
  const readonly = { role: "readonly", active: true } as const;
  const werkstatt = { role: "werkstatt", active: true } as const;
  assert.equal(hasLagerCapability(readonly, "lager.lesen"), true);
  assert.equal(hasLagerCapability(readonly, "lager.werte"), false);
  assert.equal(hasLagerCapability(readonly, "lager.buchen"), false);
  assert.equal(hasLagerCapability(werkstatt, "lager.buchen"), true);
  assert.equal(hasLagerCapability(werkstatt, "lager.stamm"), false);
});


// Unchanged approved P1 cases: quantity.test.ts


test('A02: zwei volle Packungen und drei lose Stück', () => {
  equal(countLagerPackages({
    unopened: '2', contentPerPackage: { amount: '10', unit: 'stk' },
    openedRemainders: [{ amount: '3', unit: 'stk' }],
  }, 'stk').totalAmount, '23');
});

test('A04/A05: volle Kanister und mehrere Reste werden exakt summiert', () => {
  const full = { amount: '20', unit: 'l' } as const;
  const rest = { amount: '7500', unit: 'ml' } as const;
  equal(countLagerPackages({ unopened: '2', contentPerPackage: full, openedRemainders: [rest] }, 'l').totalAmount, '47.5');
  equal(countLagerPackages({ unopened: '2', contentPerPackage: full, openedRemainders: [rest, { amount: '2', unit: 'l' }] }, 'l').totalAmount, '49.5');
});

test('A09: unbekannte Reste und fehlender Gebindeinhalt bleiben offen', () => {
  deepEqual(countLagerPackages({
    unopened: '1', contentPerPackage: null,
    openedRemainders: [null, { amount: '7.5', unit: 'l' }],
  }, 'l'), { knownAmount: '7.5', totalAmount: null, unit: 'l' });
  equal(countLagerPackages({ unopened: '0', contentPerPackage: null, openedRemainders: [] }, 'l').totalAmount, '0');
});

test('A06/A07: Stück und Paar sowie Masse und Volumen sind nicht austauschbar', () => {
  throws(() => countLagerPackages({ unopened: '1', contentPerPackage: { amount: '100', unit: 'stk' }, openedRemainders: [] }, 'paar'), /INCOMPATIBLE/);
  throws(() => countLagerPackages({ unopened: '1', contentPerPackage: { amount: '1', unit: 'kg' }, openedRemainders: [] }, 'l'), /INCOMPATIBLE/);
});

test('Ungültige, zu genaue und überlaufende Werte werden abgewiesen', () => {
  throws(() => countLagerPackages({ unopened: '1.5', contentPerPackage: null, openedRemainders: [] }, 'stk'), /INVALID/);
  throws(() => countLagerPackages({ unopened: '0', contentPerPackage: null, openedRemainders: [{ amount: '0.001', unit: 'ml' }] }, 'l'), /PRECISION_LOSS/);
  throws(() => countLagerPackages({ unopened: '99999999999', contentPerPackage: { amount: '2', unit: 'stk' }, openedRemainders: [] }, 'stk'), /OVERFLOW/);
});

test('A03/A08: verschiedene Gebindeschlüssel und historische Inhalte werden gemeinsam gezählt', () => {
  const charge = (amount: string) => ({
    unopened: '1',
    contentPerPackage: { amount, unit: 'l' as const },
    openedRemainders: [],
  });
  equal(countLagerPackageGroups([charge('20'), charge('5')], 'l').totalAmount, '25');
  equal(countLagerPackageGroups([charge('20'), charge('4')], 'l').totalAmount, '24');
});

test('A07: dimensionsfremde Gebindeumrechnung verlangt belegte Basismenge', () => {
  const gruppe = {
    unopened: '2',
    contentPerPackage: { amount: '3', unit: 'kg' as const },
    openedRemainders: [],
  };
  const beleg = { documentId: 'TEST-beleg', quantity: { amount: '2.5', unit: 'l' as const } };
  equal(countLagerPackages({ ...gruppe, verifiedBaseContent: beleg }, 'l').totalAmount, '5');
  throws(() => countLagerPackages({
    ...gruppe, verifiedBaseContent: { ...beleg, documentId: '' },
  }, 'l'), /INVALID_LAGER_CONVERSION_EVIDENCE/);
});


// Unchanged approved P1 cases: stammbefehl.test.ts


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
