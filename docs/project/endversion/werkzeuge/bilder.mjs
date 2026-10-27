// Prüfbilder + Laufzeit-Check aller Screens je Rolle (Playwright). Aufruf: node werkzeuge/bilder.mjs
import { chromium } from 'playwright'; import path from 'node:path'; import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
const D = path.resolve(import.meta.dirname, '..'); const OUT = path.join(D, '_pruefbilder'); fs.mkdirSync(OUT, { recursive: true });
const url = q => pathToFileURL(path.join(D, 'index.html')).href + '?' + q;
const MASSE = { desktop: [1914, 917], tablet: [1220, 880], handy: [390, 844] };
const browser = await chromium.launch(); const fehler = [];
async function seite(q, g) { const [w, h] = MASSE[g]; const p = await browser.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', e => fehler.push(q + ' · ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/URL scheme "file"|Failed to load resource|ERR_FILE|fonts\.g/.test(m.text())) fehler.push(q + ' · ' + m.text()); }); await p.goto(url(q)); await p.waitForTimeout(500); return p; }
const bilder = [
  ['rolf_desktop_tag', 'pruef&rolle=meister&geraet=desktop', 'desktop'],
  ['rolf_desktop_tag_ohne_regeln', 'pruef&rolle=meister&geraet=desktop&regeln=aus', 'desktop'],
  ['rolf_desktop_eingang', 'pruef&rolle=meister&geraet=desktop&screen=eingang', 'desktop'],
  ['rolf_desktop_eingang_luecke', 'pruef&rolle=meister&geraet=desktop&screen=eingang&zustand=teilweise', 'desktop'],
  ['rolf_desktop_auftrag', 'pruef&rolle=meister&geraet=desktop&screen=auftrag&arg=A-2026-0101&regeln=aus', 'desktop'],
  ['rolf_desktop_kunde_unvollstaendig', 'pruef&rolle=meister&geraet=desktop&screen=kunde&arg=K-2026-0015&regeln=aus', 'desktop'],
  ['rolf_desktop_geld', 'pruef&rolle=meister&geraet=desktop&screen=geld&regeln=aus', 'desktop'],
  ['rolf_desktop_geld_stufe2_datev', 'pruef&rolle=meister&geraet=desktop&screen=geld&regeln=aus&stufen=1,2&addons=DATEV', 'desktop'],
  ['rolf_handy_tag', 'pruef&rolle=meister&geraet=handy&regeln=aus', 'handy'],
  ['rolf_tablet_eingang', 'pruef&rolle=meister&geraet=tablet&screen=eingang&regeln=aus', 'tablet'],
  ['phillip_tablet_werkstatt', 'pruef&rolle=werkstatt&geraet=tablet&regeln=aus', 'tablet'],
  ['phillip_handy_auftrag', 'pruef&rolle=werkstatt&geraet=handy&screen=auftrag&arg=A-2026-0101&regeln=aus', 'handy'],
  ['gregor_desktop_einstellungen', 'pruef&rolle=developer&geraet=desktop&regeln=aus', 'desktop'],
  ['login_tablet', 'pruef&rolle=werkstatt&geraet=tablet&screen=login', 'tablet'],
  ['pruefbericht', 'ansicht=pruefung', 'desktop'],
  ['verbindungen', 'ansicht=verbindungen', 'desktop']
];
for (const [n, q, g] of bilder) { const p = await seite(q, g); await p.screenshot({ path: path.join(OUT, n + '.png'), fullPage: n === 'pruefbericht' || n === 'verbindungen' }); await p.close(); }
// Laufzeit: jeder Screen je Rolle × Gerät rendert ohne Fehler; jedes data-z zeigt auf ein gültiges Ziel; Touch auf Tablet/Handy
const spec = JSON.parse(fs.readFileSync(path.join(D, 'spec.json'), 'utf8')); const ids = new Set(spec.screens.map(s => s.id));
const lauf = []; let touchMax = 0;
for (const r of spec.rollen) for (const g of ['desktop', 'tablet', 'handy']) {
  const p = await seite(`pruef&rolle=${r.id}&geraet=${g}&regeln=aus`, g);
  for (const s of spec.screens) {
    if (s.rollen && !s.rollen.includes(r.id)) continue;
    const e = await p.evaluate(id => { KE.springe(id); const z = [...document.querySelectorAll('#geraet [data-z]')].map(x => x.dataset.z); const unb = document.getElementById('geraet').innerHTML.includes('Blocktyp „'); return { z, unb, touch: KE.touch() }; }, s.id);
    const kaputt = e.z.filter(z => !(z === 'start' || z === 'zurueck' || z.startsWith('zustand:') || z.startsWith('extern:') || ids.has(z)));
    if (kaputt.length || e.unb) lauf.push(`${r.id}/${g}/${s.id}: ${kaputt.join(',')}${e.unb ? ' Blocktyp unbekannt' : ''}`);
    if (g !== 'desktop' && e.touch.n) { touchMax = Math.max(touchMax, e.touch.n); lauf.push(`TOUCH ${r.id}/${g}/${s.id}: ${e.touch.n} < 48 px · ${e.touch.liste.slice(0, 3).join(' | ')}`); }
  }
  await p.close();
}
await browser.close();
console.log(`Bilder: ${bilder.length} in _pruefbilder/ · JS-Fehler: ${fehler.length} · Laufzeit-Befunde: ${lauf.length}`);
fehler.slice(0, 15).forEach(x => console.log('  JS  ' + x)); lauf.slice(0, 40).forEach(x => console.log('  ' + x));
fs.writeFileSync(path.join(OUT, 'laufzeit.txt'), [`JS-Fehler ${fehler.length}`, ...fehler, `Befunde ${lauf.length}`, ...lauf].join('\n'), 'utf8');
