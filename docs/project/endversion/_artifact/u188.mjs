import fs from 'node:fs';
const d = 'C:/Antygravityprojekte/04_Kundenprojekte/galvanik_kreile/02_app/docs/project/endversion/';
for (const [f, m] of [['index.html', 'buchliste'], ['spec.json', 'U-189'], ['ui_ergaenzung.css', 'U-189']]) console.log(f, m, fs.readFileSync(d + f, 'utf8').split(m).length - 1);
const f = d + 'ENTSCHEIDUNGEN_UI.md';
let l = fs.readFileSync(f, 'utf8').split('\n');
const U187 = '| U-187 | **Kunden (5)**: Kundenkarte = Standard-Baustein wie die Auftragskarte (Kürzel-Kreis, Name · K-Nr, Ansprechpartner · Ort · aktive Aufträge; Aktionen Neuer Auftrag · Mail · Öffnen). **Oranges „!“** = Achtung beim Kunden (ungelesene Mails, Terminkonflikt, Verhalten/Eigenheit, Zahlungsmoral, fehlende Pflichtdaten); Gründe in einer Zeile daneben, solche Kunden oben. Filter Alle · Mit Hinweis · Unvollständig. Werkstatt sieht keine Geld-Gründe | Kunden | 2026-10-27 | EV (Owner) | gilt |';
const NEU = [
 '| U-188 | **Buchhaltung (7)** = ein Modul, ein Menüpunkt „Buchhaltung“ (ersetzt „Geld & Rechnungen“ und den separaten Stufe-2-Eintrag). Stufe 1 = Basis, klein und einfach: Kennzahlen Geld fehlt · Abrechnen · Offen im Zahlungsziel; Liste nach Dringlichkeit Geld fehlt (überfällig, Vorkasse) → Abrechnen → Offen, Standardkarte; Aktionen Zahlung bestätigen · Erinnern · Rechnung erstellen. Stufe 2 = voller Umfang (Mahnwesen, Bankabgleich, DATEV) auf derselben Seite; vorher als eine ruhige Ausbau-Zeile, Späteres als zweite Zeile | Buchhaltung | 2026-10-27 | EV (Owner) | gilt |',
 '| U-189 | **Dringlichkeit appweit einheitlich**: weiße Karte/Zeile, links Balken 4 px im Ton, Etikett im selben Ton (Ecken 6 px), Grund in einer Zeile in Ton-Schrift, oranges „!“ = Achtung. Kein Punkt, keine farbig gefüllten Warnflächen (auch Hinweise, Bündeln, Lage-Zähler). Neutrale Zeilen ohne Balken | Design | 2026-10-27 | EV (Owner) | gilt |',
 '| U-190 | **Werkstatt (11) sachlicher**: Gruppenköpfe als schmale Überschrift mit Farblinie statt gefüllter Balken, Zähler als Etikett, Karten Ecken 8 px, Balken 4 px, Bildvorschau 56 px; Inhalt und Logik unverändert | Werkstatt | 2026-10-27 | EV (Owner) | gilt |'];
let i = l.findIndex(x => x.startsWith('| U-187 |'));
if (i >= 0) l[i] = U187; else { i = l.findIndex(x => x.startsWith('| U-186 |')); l.splice(i + 1, 0, U187); i++; }
if (!l.some(x => x.startsWith('| U-188 |'))) l.splice(i + 1, 0, ...NEU);
fs.writeFileSync(f, l.join('\n'));
console.log(l.filter(x => /^\| U-18[7-9] \||^\| U-190 \|/.test(x)).map(x => x.slice(0, 60)).join('\n'));
