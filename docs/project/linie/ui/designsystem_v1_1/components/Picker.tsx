import { Icon } from './Icon';
import { Button } from './Button';
import { Chip } from './Chip';
import { MitZustand } from './Zustand';
import type { Ton, DatenZustand, ZustandTexte } from './typen';
export interface PickerOption { id: string; titel: string; meta?: string; status?: { text: string; ton?: Ton }; gesperrt?: boolean; onWahl: () => void; }
export interface PickerProps { suche: string; onSuche: (v: string) => void; platzhalter?: string; optionen: PickerOption[]; onScannen?: () => void; zustand?: DatenZustand; texte?: ZustandTexte; }
/** Auftrag öffnen/scannen → Mehrarbeit / Fertig melden. Nur fachlich geeignete Aufträge. */
export function Picker({ suche, onSuche, platzhalter = 'Auftragsnummer, Teil oder Oberfläche', optionen, onScannen, zustand = 'daten', texte }: PickerProps) {
  const z = zustand === 'daten' && optionen.length === 0 ? 'leer' : zustand;
  return (<>
    <div className="kr-picker-werkzeug"><label className="kr-suchfeld"><Icon name="search" /><input value={suche} onChange={e => onSuche(e.target.value)} placeholder={platzhalter} autoComplete="off" autoFocus /></label>{onScannen && <Button art="sekundaer" icon="scan" text="Scannen" onClick={onScannen} />}</div>
    <MitZustand zustand={z} texte={{ titel: 'Auswahl', leerText: 'Kein passender Auftrag.', ...texte }}>
      <div className="kr-wahl-liste">{optionen.map(o => (
        <button key={o.id} type="button" className="kr-wahl" disabled={o.gesperrt} onClick={o.onWahl}>
          <span style={{ minWidth: 0 }}><span className="kr-zeile-t" style={{ fontSize: 14, display: 'block' }}><span className="kr-id">{o.id}</span>{o.titel}</span>{o.meta && <span className="kr-zeile-s" style={{ display: 'block' }}>{o.meta}</span>}</span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{o.status && <Chip text={o.status.text} ton={o.status.ton} />}<Icon name={o.gesperrt ? 'lock' : 'arrow'} /></span>
        </button>))}</div>
    </MitZustand>
  </>);
}
