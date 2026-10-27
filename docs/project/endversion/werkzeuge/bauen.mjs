// Baut spec.eingebettet.js aus spec.json und führt den Sackgassen-Check aus.
// Aufruf (aus docs/project/endversion): node werkzeuge/bauen.mjs   · Exit-Code 1 bei Fehlern
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import crypto from 'node:crypto';
const D = path.resolve(import.meta.dirname, '..');
const roh = fs.readFileSync(path.join(D, 'spec.json'), 'utf8');
const spec = JSON.parse(roh);
const sha = crypto.createHash('sha256').update(roh).digest('hex');
vm.runInThisContext(fs.readFileSync(path.join(D, 'pruefung.js'), 'utf8'));
const P = globalThis.KreilePruefung;
const konfs = { 'Stufe 1 (Standard)': { stufen: [1], addons: [] }, 'Alle Stufen + DATEV': { stufen: [1, 2, 3, 4], addons: ['DATEV'] } };
const bericht = { erzeugt: new Date().toISOString(), specSha256: sha, version: spec.meta.version, ergebnisse: {} };
let rot = 0;
for (const [name, k] of Object.entries(konfs)) {
  const r = P.pruefe(spec, k); rot += r.fehler.length;
  bericht.ergebnisse[name] = { ok: r.ok, fehler: r.fehler, hinweise: r.hinweise, zahlen: r.zahlen };
  console.log(`${r.ok ? 'GRÜN' : 'ROT '} · ${name}: ${r.fehler.length} Fehler · ${r.hinweise.length} Hinweise · ${r.zahlen.screens} Screens · ${r.zahlen.aktionen} Aktionen`);
  r.fehler.forEach(f => console.log(`   ✗ ${f.art}: ${f.text}  [${f.wo}]`));
}
fs.writeFileSync(path.join(D, 'spec.eingebettet.js'), `/* AUTOMATISCH aus spec.json erzeugt (werkzeuge/bauen.mjs) – nicht von Hand ändern. sha256 ${sha} */\nwindow.KREILE_SPEC_EINGEBETTET=${JSON.stringify({ sha, erzeugt: bericht.erzeugt, spec })};\n`, 'utf8');
fs.writeFileSync(path.join(D, 'pruefbericht.json'), JSON.stringify(bericht, null, 1), 'utf8');
console.log(`spec.eingebettet.js + pruefbericht.json geschrieben · sha256 ${sha.slice(0, 12)}`);
process.exit(rot ? 1 : 0);
