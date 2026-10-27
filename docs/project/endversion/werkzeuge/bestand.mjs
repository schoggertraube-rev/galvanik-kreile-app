// Bestandsaufnahme: alle *.html/*.png/*.jpg/*.svg unter galvanik_kreile → BESTAND.md
// Aufruf: node werkzeuge/bestand.mjs   (aus docs/project/endversion)
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const WURZEL = path.resolve(import.meta.dirname, '../../../../..'); // …/galvanik_kreile
const ZIEL = path.resolve(import.meta.dirname, '../BESTAND.md');
const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.vercel', '.turbo', 'out']);
const EXT = /\.(html|png|jpe?g|svg)$/i;
const dateien = [];
(function lauf(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  if (e.isDirectory()) { if (!SKIP.has(e.name)) lauf(path.join(d, e.name)); }
  else if (EXT.test(e.name)) dateien.push(path.join(d, e.name)); } })(WURZEL);

const rel = p => path.relative(WURZEL, p).split(path.sep).join('/');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function klasse(r) {
  if (/docs\/project\/endversion\//.test(r)) return ['ENDVERSION', 'diese Vorgabe (Prüfbilder/Renderer)'];
  if (/02_app\/(playwright-report|test-results)\//.test(r)) return ['Prüfbeleg Bau', 'keine Vorgabe'];
  if (/(^|\/)(_ARCHIV|_archive|_DELIVERY_ARCHIVE|_VERWORFEN|_bibel_historie|_archiv|_ARCHIV_verworfen|_archiv_vor_optimierung)/i.test(r)) return ['Archiv', 'keine Quelle'];
  if (/02_app\/(output|docs\/evidence|\.playwright-cli)\//.test(r)) return ['Prüfbeleg Bau', 'keine Vorgabe'];
  if (/^_DELIVERY_CORRIDOR\//.test(r)) return ['Paket-Kopie', 'Kopie, keine eigene Quelle'];
  if (/_eingang_claude_design|_DESIGN_VERBINDLICH\/BUNDLE/.test(r)) return ['Bündel-Kopie', 'Kopie, keine eigene Quelle'];
  if (/^10_dateien\//.test(r)) return ['Kreile-Website (gesichert)', 'Fremdmaterial'];
  if (/^01_website\/|02_app\/(public|src)\//.test(r)) return ['Technik-Asset', 'kein Screen'];
  if (/linie\/ui\/designsystem_v1_1\//.test(r)) return ['VERBINDLICH', 'Designsystem V1.1 (Farben, Bausteine)'];
  if (/^_DESIGN_VERBINDLICH\/designsystem_v1_1\//.test(r)) return ['Kopie', 'Ursprung V1.1 (identisch mit linie/ui)'];
  if (/designsystem_v1\/|designsystem_v2\//.test(r)) return ['überholt', 'ersetzt durch V1.1 (27.09.)'];
  if (/docs\/delivery\/KREILE_BAUUMFANG_STUFEN/.test(r)) return ['VERBINDLICH', 'Bauumfang 25.10.'];
  if (/linie\/ui\/KREILE_/.test(r)) return ['Ablauf-/Inhaltsreferenz', 'Inhalt gilt, Optik nicht (Owner 26.10.)'];
  if (/00_BIBEL\/design und klickpfade UI\//.test(r)) return /ROLF_V8|PHILLIP_V4|AUFTRAGSKARTE_MACHART_V8|KUNDENKARTE_MACHART_V2/.test(r) ? ['Original-Vorlage', 'identisch mit linie/ui'] : ['überholt', 'ältere Fassung'];
  if (/00_BIBEL\/mock_extract\//.test(r)) return ['Extrakt V5', 'Bauvorlage aus V5, Optik überholt'];
  if (/02_app\/Claude outputs\//.test(r)) return ['überholt', 'Zwischenstand 14.09.'];
  return ['sonstig', 'prüfen'];
}
function bildschirm(r) {
  const n = r.toLowerCase();
  const m = [[/startseite_rolf|rolf_home|rolf_desktop|rolf_tablet|rolf_handy/, 'Der Tag (Rolf)'], [/phillip/, 'Werkstatt (Phillip)'], [/gregor/, 'Einstellungen (Gregor)'],
    [/auftragskarte|card_order|seitenblatt_auftrag/, 'Auftragskarte'], [/kundenkarte|card_customer|kunde_zurueck/, 'Kundenkarte'], [/gesamtmock/, 'Gesamtablauf alle Screens'],
    [/kundenansicht/, 'Alle Screens (Prototyp)'], [/katalog/, 'Komponentenkatalog'], [/bauumfang/, 'Bauumfang Stufen'], [/login/, 'Login'], [/modal_search|befehlspalette|suche/, 'Suche'],
    [/modal_more/, 'Mehr-Menü'], [/create_choose|neuer_eingang|eingang/, 'Neuer Eingang'], [/rolf_orders|auftraege/, 'Aufträge'], [/rolf_customers|kunden/, 'Kunden'],
    [/rolf_accounting|buchhaltung|geld/, 'Geld & Rechnungen'], [/rolf_settings|einstellungen/, 'Einstellungen'], [/rolf_werkstatt|werkstatt/, 'Werkstatt'], [/shell/, 'App-Rahmen'],
    [/warendurchlauf/, 'Warendurchlauf (verworfen)'], [/logo|wordmark/, 'Logo'], [/mindmap/, 'Modulkarte'], [/10_dateien/, 'Kreile-Website']];
  for (const [re, t] of m) if (re.test(n)) return t; return '—';
}
const version = r => (r.match(/[_ -]V(\d+(?:_\d+)?)/i) || r.match(/designsystem_v(\d+(?:_\d+)?)/i) || [, ''])[1].replace('_', '.') || '—';
// Manuelle Widerspruchs-Notizen (geprüft, Stand 27.10.2026)
const W = [
  [/linie\/ui\/KREILE_STARTSEITE_ROLF_V8/, 'Optik beige ↔ V1.1 neutral (Owner 26.10.: V1.1-Farben). Tageskacheln ↔ V1.1-Zeitstrahl (Owner 27.09.: Zeitstrahl). Begrüßung/„Das braucht dich“/„erledigt, sobald…“ ↔ V1.1 §6 entfernt (OF-01). Größen gelten (Owner 27.10.).'],
  [/linie\/ui\/KREILE_STARTSEITE_PHILLIP_V4/, 'Optik ↔ V1.1. Riesenzahl WIP ↔ V1.1 16 px (OF-03). Größen gelten.'],
  [/linie\/ui\/KREILE_AUFTRAGSKARTE_MACHART_V8/, 'Optik ↔ V1.1. Overline/Erklärtexte ↔ V1.1 entfernt (OF-05). „geplant“-Steckplatz ↔ V1.1 „In Aufbau“ (Owner 27.10.: „geplant“).'],
  [/linie\/ui\/KREILE_KUNDENKARTE_MACHART_V2/, 'Optik ↔ V1.1. Analyse-/Marketing-Teil ↔ Bauumfang A06 „ohne Analyse“. Pflichtfelder ↔ Owner 26.10. (Ansprechpartner, Land, Zahlungsbedingung fehlen).'],
  [/linie\/ui\/KREILE_GESAMTMOCK_V5/, 'Optik ↔ V1.1. OCR-/Dokumentweg vorhanden ↔ V1.1 OF-07 „nicht gezeigt“ ↔ Bauumfang E04 Stufe 1. „Infos rein“ ↔ Owner 26.10. „ein Einstieg: Neuer Eingang“.'],
  [/linie\/ui\/designsystem_v1_1\/kundenansicht/, 'Neukunde nur Name/Straße/PLZ/Ort/Tel/Mail ↔ Owner 26.10. Pflichtdaten. „In Aufbau“ ↔ Owner „geplant“. Mail/OCR/Datenkiste/Firmendaten/Katalog fehlen ↔ Bauumfang E01/E04/E05/S01/S02. „Wunschtermin“ ↔ Bauumfang E02 „Liefertermin (Pflicht)“. Größe zu klein ↔ Owner 27.10. (V8-Größen).'],
  [/linie\/ui\/designsystem_v1_1\/katalog/, 'Bausteine gelten; Ausgrau kennt nur „In Aufbau/In Klärung“ ↔ Owner „geplant“.'],
  [/docs\/delivery\/KREILE_BAUUMFANG_STUFEN/, 'Zeile „OPTIK: Rolf V8 …“ ↔ Owner 26.10. „Optik = V1.1“. Stufen 2–4 nur als Paketnamen (Buchhaltung & Geld · Werkstatt · Assistent), Zuordnung 2/3/4 nicht ausdrücklich.'],
  [/linie\/ui\/designsystem_v1_1\/_pruefbilder/, 'Bild zu V1.1; Größe ↔ Owner 27.10.'],
  [/designsystem_v1\/|designsystem_v2\//, 'ersetzt durch V1.1'],
  [/_VERWORFEN_V6/, 'vom Owner verworfen (21.09.)'],
  [/GESAMTMOCK_V[234]|03_REFERENZ_GESAMTMOCK_V4/, 'ersetzt durch Gesamtmock V5 (CURRENT_DESIGN_REFERENCE.json)'],
  [/STARTSEITE_ROLF_V[57]|STARTSEITE_PHILLIP_V[12]|AUFTRAGSKARTE_MACHART_V[37]|KUNDENKARTE_MACHART_V1/, 'ersetzt durch Rolf V8 / Phillip V4 / Auftragskarte V8 / Kundenkarte V2'],
  [/public\/warendurchlauf/, 'verworfenes Stationsband-Design (Altlast)'],
  [/02_app\/buchhaltung\//, 'alte Buchhaltungsskizze ↔ Bauumfang B04 Stufe 2 (gesperrt)']
];
const widerspruch = r => (W.find(([re]) => re.test(r)) || [, ''])[1];

const zeilen = dateien.map(p => { const r = rel(p), st = fs.statSync(p); return { r, h: hash(p), d: st.mtime.toISOString().slice(0, 10), g: st.size, k: klasse(r) }; });
const erst = new Map(); const rang = z => ['VERBINDLICH', 'Ablauf-/Inhaltsreferenz', 'Original-Vorlage', 'Extrakt V5', 'Kopie', 'Bündel-Kopie', 'Paket-Kopie'].indexOf(z.k[0]) + 1 || 99;
[...zeilen].sort((a, b) => rang(a) - rang(b) || a.r.localeCompare(b.r)).forEach(z => { if (!erst.has(z.h)) erst.set(z.h, z.r); });
zeilen.sort((a, b) => rang(a) - rang(b) || a.r.localeCompare(b.r));
const esc = s => String(s).replace(/\|/g, '\\|');
const gruppe = {}; zeilen.forEach(z => { gruppe[z.k[0]] = (gruppe[z.k[0]] || 0) + 1; });
const dup = zeilen.filter(z => erst.get(z.h) !== z.r).length;
let md = `# BESTAND · Oberflächen-Quellen Kreile WerkstattCockpit\n\nErzeugt ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC mit \`werkzeuge/bestand.mjs\` · Wurzel \`galvanik_kreile/\` · ${zeilen.length} Dateien (*.html, *.png, *.jpg, *.svg; ohne node_modules/.next/.git).\n\n`;
md += `## Ergebnis in einem Satz\nVerbindlich sind nur **Designsystem V1.1** (Farben, Bausteine) und **Bauumfang 25.10.** (Funktionen, Stufen). Rolf V8, Phillip V4, Auftragskarte V8, Kundenkarte V2 und Gesamtmock V5 sind **Ablauf-/Inhaltsreferenz** (und Größenmaß). Alles andere ist Kopie, Beleg, Archiv oder überholt.\n\n`;
md += `## Zusammenfassung\n| Status | Anzahl |\n|---|---|\n${Object.entries(gruppe).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`).join('\n')}\n| davon byte-identische Kopien | ${dup} |\n\n`;
md += `**Hinweis „Kundenkarte V5“:** Eine Datei *Kundenkarte V5* existiert nicht (nur Machart V1 und V2). Gelesen als Kundenkarte im **Gesamtmock V5**.\n\n`;
const kern = zeilen.filter(z => !['Archiv', 'Prüfbeleg Bau', 'Paket-Kopie', 'Bündel-Kopie', 'Technik-Asset', 'Kreile-Website (gesichert)'].includes(z.k[0]));
md += `## A · Maßgebliche und überholte Vorlagen (${kern.length})\n| Datei | Bildschirm/Modul | Version | Datum | Status | Widerspricht wem |\n|---|---|---|---|---|---|\n`;
md += kern.map(z => `| \`${esc(z.r)}\` | ${bildschirm(z.r)} | ${version(z.r)} | ${z.d} | ${z.k[0]}${erst.get(z.h) !== z.r ? ` · identisch mit \`${esc(erst.get(z.h))}\`` : ''} | ${esc(widerspruch(z.r) || z.k[1])} |`).join('\n') + '\n\n';
const rest = zeilen.filter(z => !kern.includes(z));
md += `## B · Kopien, Belege, Archiv, Technik (${rest.length})\nKeine Vorgabe für Bau oder Prüfung. Vollständig gelistet zur Nachvollziehbarkeit.\n\n| Datei | Bildschirm/Modul | Version | Datum | Status | Hinweis |\n|---|---|---|---|---|---|\n`;
md += rest.map(z => `| \`${esc(z.r)}\` | ${bildschirm(z.r)} | ${version(z.r)} | ${z.d} | ${z.k[0]} | ${erst.get(z.h) !== z.r ? `identisch mit \`${esc(erst.get(z.h))}\`` : esc(widerspruch(z.r) || z.k[1])} |`).join('\n') + '\n';
fs.writeFileSync(ZIEL, md, 'utf8');
console.log(`BESTAND.md: ${zeilen.length} Dateien, Kern ${kern.length}, Rest ${rest.length}, Duplikate ${dup}`);
