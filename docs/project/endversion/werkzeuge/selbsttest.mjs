// Selbsttest des Sackgassen-Checks: absichtlich kaputte Specs müssen ROT werden.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
const D = path.resolve(import.meta.dirname, '..');
vm.runInThisContext(fs.readFileSync(path.join(D, 'pruefung.js'), 'utf8'));
const P = globalThis.KreilePruefung;
const neu = () => JSON.parse(fs.readFileSync(path.join(D, 'spec.json'), 'utf8'));
const sc = (x, id) => x.screens.find(s => s.id === id);
const faelle = {
  'Overlay ohne Ausweg': x => { sc(x, 'zahlung').aktionen = sc(x, 'zahlung').aktionen.filter(a => a.ziel !== 'zurueck'); },
  'Ziel unbekannt': x => { sc(x, 'kunden').aktionen[0].ziel = 'kundneu'; },
  'Aktion ohne Ziel': x => { sc(x, 'kunden').aktionen.push({ text: 'Export', icon: 'upload' }); },
  'Zustand fehlt': x => { delete sc(x, 'geld').zustaende.fehler; },
  'Zustand ohne Ausweg': x => { sc(x, 'geld').zustaende.leer.aktionen = []; },
  'Screen unerreichbar': x => { x.screens.push({ id: 'waise', typ: 'dialog', titel: 'Waise', funktion: ['A04'], rollen: ['meister'], aktionen: [{ text: 'Schließen', ziel: 'zurueck' }], zustaende: { leer: { na: 'x' }, teilweise: { na: 'x' }, fehler: { na: 'x' }, erfolg: { na: 'x' } } }); },
  'Stufe 1 nicht abgedeckt': x => { x.funktionen.push({ id: 'E09', name: 'Test', stufe: 1 }); },
  'Ablauf unterbrochen': x => { x.flows[0].schritte.push('datevein'); }
};
let ok = true;
const basis = P.pruefe(neu(), { stufen: [1], addons: [] });
console.log(`Basis: ${basis.ok ? 'GRÜN' : 'ROT'} (${basis.fehler.length} Fehler)`); if (!basis.ok) ok = false;
for (const [n, f] of Object.entries(faelle)) {
  const x = neu(); f(x); const r = P.pruefe(x, { stufen: [1], addons: [] });
  const erkannt = !r.ok; if (!erkannt) ok = false;
  console.log(`${erkannt ? '✓' : '✗'} ${n}: ${r.fehler.length} Fehler · ${r.fehler[0] ? r.fehler[0].art + ' – ' + r.fehler[0].text : 'NICHT ERKANNT'}`);
}
process.exit(ok ? 0 : 1);
