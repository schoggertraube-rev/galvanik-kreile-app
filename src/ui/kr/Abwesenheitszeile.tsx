import { Zeile } from './Zeile';
import { Chip } from './Chip';
export interface AbwesenheitszeileProps { kuerzel: string; person: string; /** „JJJJ-MM-TT bis JJJJ-MM-TT“ */ zeitraum: string; art: string; }
/** Quelle: Kalender Kreile-Büropostfach, read-only (OE-2609-18/19) */
export function Abwesenheitszeile({ kuerzel, person, zeitraum, art }: AbwesenheitszeileProps) {
  return <Zeile vorne={<span className="kr-av">{kuerzel}</span>} titel={person} meta={zeitraum} seite={<Chip text={art} ton="info" icon="calendar" />} />;
}
