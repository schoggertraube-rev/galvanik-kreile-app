'use client';

import {weiterMitEnter} from './tastatur';
import type {AuswahlOption} from './Formular';
import {Textfeld} from './design-final/Textfeld';
import styles from './design-final/Textfeld.module.css';

interface FeldBasis {
  id:string;
  label:string;
  laden:boolean;
  deaktiviert:boolean;
  pflicht?:boolean;
  grenzen?:{min?:string|number;max?:string|number;schritt?:string|number};
  fehler?:{text:string;specId:string};
}
export type FormularfeldProps=FeldBasis&(
  |{art:'text'|'zahl'|'datum'|'mehrzeilig';wert:string;onWert:(wert:string)=>void}
  |{art:'auswahl';wert:string;onWert:(wert:string)=>void;optionen:readonly AuswahlOption[]}
  |{art:'checkbox';wert:boolean;onWert:(wert:boolean)=>void}
);

export function Formularfeld(props:FormularfeldProps) {
  const errorId=props.id+'-error';
  const common={id:props.id,disabled:props.laden||props.deaktiviert,required:props.pflicht,
    'aria-invalid':props.fehler?true:undefined,'aria-describedby':props.fehler?errorId:undefined};
  const feld = props.art === 'checkbox' || props.art === 'auswahl'
    ? <div className={styles.feld}>
      <label htmlFor={props.id} className={styles.label}>{props.label}</label>
      {props.art === 'checkbox'
        ? <input {...common} className={styles.kaestchen} type="checkbox" checked={props.wert}
            onChange={event => props.onWert(event.currentTarget.checked)} />
        : <select {...common} className={styles.eingabe} value={props.wert} onChange={event => props.onWert(event.currentTarget.value)}>
            {props.optionen.map(option => <option key={option.wert} value={option.wert} disabled={option.gesperrt}>{option.text}</option>)}
          </select>}
      {props.fehler && <p className={styles.fehler} id={errorId} data-spec-id={props.fehler.specId}>{props.fehler.text}</p>}
    </div>
    : <Textfeld id={props.id} label={props.label} wert={props.wert} onWert={props.onWert}
        typ={props.art === 'zahl' ? 'number' : props.art === 'datum' ? 'date' : 'text'}
        mehrzeilig={props.art === 'mehrzeilig'} grenzen={props.grenzen}
        inputMode={props.art === 'zahl' ? 'decimal' : undefined} enterKeyHint={props.art === 'mehrzeilig' ? undefined : 'next'}
        laedt={props.laden} deaktiviert={props.deaktiviert} pflicht={props.pflicht}
        fehler={props.fehler?.text} fehlerId={errorId} fehlerSpecId={props.fehler?.specId} />;
  return <div data-spec-id="baustein.formularfeld" aria-busy={props.laden} onKeyDown={weiterMitEnter}>
    {feld}
  </div>;
}
