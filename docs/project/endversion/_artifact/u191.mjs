import fs from 'node:fs';
const d = 'C:/Antygravityprojekte/04_Kundenprojekte/galvanik_kreile/02_app/docs/project/endversion/';
for (const [f, m] of [['index.html', 'typZeichen'], ['spec.json', 'U-191'], ['ui_ergaenzung.css', 'U-191']]) console.log(f, m, fs.readFileSync(d + f, 'utf8').split(m).length - 1);
const f = d + 'ENTSCHEIDUNGEN_UI.md';
let l = fs.readFileSync(f, 'utf8').split('\n');
const NEU = [
 '| U-191 | **CI appweit (verbindlich für alle Seiten, Dialoge, Untermenüs)**: (1) Flächen weiß wie die Anmeldeseite, neutrale kühle Grautöne, kein Sand; (2) Karten heben sich ab durch Linie + einheitlichen Kartenschatten; (3) eine Ecken-Skala: Etikett 4 · Bild/Knopf 6–8 · Karte 10 · Kachel 12 · Dialog 14; (4) Serifen nur für Seiten-/Dialogtitel, Marke, Anmeldegruß – Nummern, Zähler, Zeiten serifenlos; (5) **Objekttyp sofort erkennbar**: jede Nummer mit Typ-Zeichen wie in der Navigation – Auftrag (Liste) · Kunde (Person) · Rechnung (Beleg) · Mail; (6) **Dringlichkeit** = Balken links 6 px + Etikett im selben Ton: rot dringend/Geld fehlt · orange Achtung · amber in Arbeit · navy zu tun · grün erledigt · grau wartet. Werkstatt-Gruppenköpfe wieder gefüllt (klar erkennbar), aber sachlich: 48 px, Ecken 8, serifenlose Zahl – ersetzt den Kopf-Teil von U-190. Appweite Wünsche werden immer sofort überall umgesetzt (OR-11) | Design/CI | 2026-10-27 | EV (Owner) | gilt |',
 '| U-192 | **Einstellungen (8)** nüchtern in Reitern nach Themen: Firma · Leistungen & Preise · Personen & Rechte · Zahlung · Daten & Export; eine Spalte, Kacheln nach CI; Reiter ohne sichtbaren Inhalt für die Rolle entfallen (Phillip: Firma · Personen & Rechte · Daten & Export) | Einstellungen | 2026-10-27 | EV (Owner) | gilt |'];
const i = l.findIndex(x => x.startsWith('| U-190 |'));
if (i >= 0 && !l.some(x => x.startsWith('| U-191 |'))) l.splice(i + 1, 0, ...NEU);
const j = l.findIndex(x => x.startsWith('| U-189 |'));
if (j >= 0) l[j] = l[j].replace('links Balken 4 px', 'links Balken 6 px (U-191)');
fs.writeFileSync(f, l.join('\n'));
console.log(l.filter(x => /^\| U-19\d \|/.test(x)).map(x => x.slice(0, 50)).join('\n'));
