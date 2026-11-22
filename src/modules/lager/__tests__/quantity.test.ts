import { equal, deepEqual, throws } from 'node:assert/strict';
import { test } from 'vitest';
import { countLagerPackageGroups, countLagerPackages } from '../quantity';

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
