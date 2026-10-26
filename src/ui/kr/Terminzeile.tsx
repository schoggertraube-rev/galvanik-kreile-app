import { Zeile } from './Zeile';
import { Chip } from './Chip';
import type { Terminart, Ton } from './typen';
const TON: Record<Terminart, Ton | undefined> = { Wunsch: 'warn', bestätigt: 'ok', verschoben: 'rot', Abholung: 'info', Versand: 'info', Betrieb: undefined };
export interface TerminzeileProps { /** Uhrzeit oder Wochentag */ zeit: string; art: Terminart; auftragNr?: string; kundeKurz: string; meta?: string; onOeffnen?: () => void; }
/** Übersicht minimal: Terminart · Auftragsnr. · Kundenkurzname (OE-2609-19) */
export function Terminzeile({ zeit, art, auftragNr, kundeKurz, meta, onOeffnen }: TerminzeileProps) {
  return <Zeile vorne={<span className="kr-zeit">{zeit}</span>} id={auftragNr} titel={kundeKurz} meta={meta} seite={<Chip text={art} ton={TON[art]} />} onClick={onOeffnen} />;
}
