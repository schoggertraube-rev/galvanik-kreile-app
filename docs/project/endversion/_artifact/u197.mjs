import fs from 'node:fs';
const d = 'C:/Antygravityprojekte/04_Kundenprojekte/galvanik_kreile/02_app/docs/project/endversion/';
for (const [f, m] of [['index.html', "case 'fertigmelden'"], ['spec.json', 'OR-12'], ['ui_ergaenzung.css', 'U-197']]) console.log(f, m, fs.readFileSync(d + f, 'utf8').split(m).length - 1);
const f = d + 'ENTSCHEIDUNGEN_UI.md';
let l = fs.readFileSync(f, 'utf8').split('\n');
const NEU = [
 '| U-197 | **Mehrarbeit (4.3) für Hände im Dreck**: Wo? (ganzer Auftrag oder Teil) · Was? große Kacheln je Arbeitsgang, jedes Antippen = feste Minuten (Löten 5 · Schleifen 5 · Polieren 5 · Strahlen 10 · Nacharbeit 15 · Sonstiges 5), „−“ nimmt zurück; Regler zeigt die Summe gegen den KV-Spielraum: grün im Umfang, ab 80 % orange, darüber rot („Preisfreigabe bei Rolf“). „Kunde informieren“ verschickt automatisch eine Mail mit Hinweis (bei Überschreitung ohne Preis). Speichern verteilt sofort an Verlauf, Rechnungsposition, Terminprognose, Der Tag (bei Überschreitung) und Erfahrungswerte. Foto und Notiz per Diktat optional. Phillip sieht Minuten, keine Euro | Auftrag | 2026-10-27 | EV (Owner) | gilt |',
 '| U-198 | **Fertig melden (4.4) heißt ergänzen**: je Teil Haken antippen, gut/Ausschuss mit + / − (zusammen höchstens die Stückzahl), Grund per Antippen, fehlendes Fertigfoto direkt aufnehmen, Notiz per Diktat, Mehrarbeit nachtragen, Problem melden; oben der Stand („3 von 3 Teilen fertig – bereit“). „Kunde informieren“ ist vorausgewählt. Danach Werkstatt › Fertig, Ware raus, Buchhaltung › Abrechnen | Auftrag | 2026-10-27 | EV (Owner) | gilt |',
 '| U-199 | **Aufwand, Priorität und Termin – wichtig**: entscheidend sind KV und Menge der Einzelteile, der bei Auftragsannahme im KV eingeplante Aufwand und Erfahrungswerte ähnlicher Aufträge und Teile (Median Ist ÷ Plan der letzten 10 ähnlichen, gleicher Kunde doppelt, begrenzt 0,7–1,8). Stufe 1 = einfacher Algorithmus (werkstattregel), Stufe 4 (Z04) = die App lernt aus Ist-Zeiten, Mehrarbeit und Fertigmeldungen. Beantwortet die offene Frage zum Auftragswert (= Summe der KV-Positionen) | Logik | 2026-10-27 | EV (Owner) | gilt |'];
const i = l.findIndex(x => x.startsWith('| U-196 |'));
if (i >= 0 && !l.some(x => x.startsWith('| U-197 |'))) l.splice(i + 1, 0, ...NEU);
fs.writeFileSync(f, l.join('\n'));
console.log(l.filter(x => /^\| U-19[6-9] \|/.test(x)).map(x => x.slice(0, 40)).join('\n'));
