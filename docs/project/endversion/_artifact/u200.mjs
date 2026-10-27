import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const d = 'C:/Antygravityprojekte/04_Kundenprojekte/galvanik_kreile/02_app/docs/project/endversion/';
for (const [f, m] of [['index.html', 'loginverwaltung'], ['spec.json', 'OR-15'], ['pruefung.js', 'Objekt-Verweise']]) console.log(f, m, fs.readFileSync(d + f, 'utf8').split(m).length - 1);
const sha = crypto.createHash('sha256').update(fs.readFileSync(d + 'spec.json')).digest('hex').slice(0, 12);
console.log('spec sha', sha);
// ABGLEICH suchen
const such = (dir, tiefe) => { let r = []; if (tiefe < 0) return r; let e = []; try { e = fs.readdirSync(dir, { withFileTypes: true }); } catch { return r; } for (const x of e) { if (x.name === 'node_modules' || x.name.startsWith('.')) continue; const p = path.join(dir, x.name); if (x.isDirectory()) r = r.concat(such(p, tiefe - 1)); else if (/^ABGLEICH/i.test(x.name)) r.push(p); } return r; };
console.log('ABGLEICH:', JSON.stringify(such('C:/Antygravityprojekte/04_Kundenprojekte/galvanik_kreile/02_app/docs', 4)));
// Entscheidungen
const f = d + 'ENTSCHEIDUNGEN_UI.md';
let l = fs.readFileSync(f, 'utf8').split('\n');
const NEU = [
 '| U-200 | **Rechte & Logins**: Wer was sehen und tun darf, legt vorerst nur Gregor fest – Wartung › Logins & Rechte (8.5, umgewidmet): Haken je Login und Bereich (Aufträge & Werkstatt · Neuer Eingang & Kunde anlegen · Kunden & Kontakt · Geld, Preise & Buchhaltung · Mails · Firmen-Einstellungen · Logins & Rechte · Wartung), wirkt sofort, ohne Haken unsichtbar. Gregor legt Logins an und ändert sie (Name, Kürzel, Bezeichnung, Vorlage, Code, aktiv); Gregors Logins & Rechte und Wartung sind fest (kein Aussperren). Alle anderen ändern nur den eigenen Code (8.8). Innerhalb seiner Rechte stellt sich jeder Login „Der Tag“ selbst zusammen. Rollen in der Spec sind nur Vorlagen; ersetzt U-031 (Admin-Rechte bei Rolf) bis auf Weiteres | Rechte | 2026-10-27 | EV (Owner) | gilt |',
 '| U-201 | **Jede Ansicht zeigt das angeklickte Objekt**: Auftragskarte, Kundenkarte, Mehrarbeit, Fertig melden, Rechnung, Zahlung, Warenausgang und „Neuer Auftrag“ werden aus dem Auftrag/Kunden/der Rechnung gebildet; Dialoge zeigen oben das Objekt (Nummer · Kunde · Teil). Unbekannte Nummer = Fehlerzustand. Abschluss (Buchen, Speichern) schließt den Dialog und öffnet das neue Objekt. Pflicht-Gate beim Buchen (springt zur ersten offenen Angabe), Abbrechen fragt „Entwurf behalten?“ (3.6). Prüfer-Regel 9: jeder Verweis löst auf | Logik | 2026-10-27 | EV (Owner) | gilt |',
 '| U-202 | **Mock nie an Codex**: index.html, Musterdaten, Mock-Texte und Bildschirmfotos dienen nur der Darstellung für die Owner. An Codex geht ausschließlich der Bauplan (Struktur, Felder, Regeln, Rechte, Zustände, Abläufe) ohne Inhalt (OR-13) | Export | 2026-10-27 | EV (Owner) | gilt |',
 '| U-203 | **Abgleich Spec ↔ Code**: ABGLEICH_SPEC_CODE.md wird übernommen, sobald vorhanden – je Element Kennzeichnung `aenderung`: optik / inhalt_neu / funktion_neu in spec.json; Widersprüche zu Server-Regeln werden der Owner einzeln vorgelegt. Jede Freigabe in FREIGABEN.md mit Screen-IDs und spec-Stand (sha256) (OR-15) | Ablauf | 2026-10-27 | EV (Owner) | gilt |',
 '| U-204 | **Prüfbefunde 27.10. umgesetzt**: Bündeln als Dialog (11.1); Abschluss-Knöpfe grün, „Öffnen“ neutral; Doppelungen in der Auftragskarte raus (Kunden-Update, Foto+/Dokument+, Mail in der Akte), M5 ohne „Auftrag öffnen“, Aufträge-Seite ohne zweites „Neuer Eingang“; Der Tag: „Foto aufnehmen“, „Prüfen & freigeben“, A-0102 heute fällig für alle; Werkstatt › Dringend mit „Fertig melden“; Zähler aus den Daten (In Arbeit, Aufträge · KV); Geplantes einheitlich „Stufe n“ bzw. „geplant“ ohne Werte; ein Datumsformat appweit (Mo 28.09.); Wartung-Befunde aus den Daten; Fertig-Schalter „fertig?“/„fertig“. Abgelehnt: weiße Gruppenköpfe (bleibt U-191) | Design/Logik | 2026-10-27 | EV (Owner) | gilt |'];
const i = l.findIndex(x => x.startsWith('| U-199 |'));
if (i >= 0 && !l.some(x => x.startsWith('| U-200 |'))) l.splice(i + 1, 0, ...NEU);
fs.writeFileSync(f, l.join('\n'));
console.log(l.filter(x => /^\| U-20\d \|/.test(x)).map(x => x.slice(0, 30)).join('\n'));
// FREIGABEN: Regel + Protokoll-Format
const fr = d + 'FREIGABEN.md'; let t = fs.readFileSync(fr, 'utf8');
if (!t.includes('## Freigabe-Protokoll (Format, OR-15)')) {
  t += `\n\n## Freigabe-Protokoll (Format, OR-15)\nJede Freigabe als eigene Zeile: Datum · Screen-IDs (Nummer + id) · spec-Stand (sha256, erste 12 Zeichen) · Ergebnis · Bemerkung.\nAn Codex geht nur der Bauplan ohne Inhalt (OR-13/U-202) – nie index.html, Musterdaten oder Bildschirmfotos.\n\n| Datum | Screens | spec-Stand | Ergebnis | Bemerkung |\n|---|---|---|---|---|\n| 2026-10-27 | – | ${sha} | Stand zur Prüfung (keine Freigabe) | nach U-200–U-204; nächste Seite: 10 Ware raus |\n`;
  fs.writeFileSync(fr, t);
}
console.log('--- FREIGABEN (Anfang)'); console.log(t.split('\n').slice(0, 40).join('\n'));
