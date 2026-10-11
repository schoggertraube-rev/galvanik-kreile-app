'use client';
import { Button } from './Button';
export interface PinEingabeProps { laenge: number; meldung?: string; onZiffer: (z: string) => void; onLoeschen: () => void; onNeu: () => void; onEmailAnmeldung?: () => void; }
/** Login /start: PIN, ohne Slogan/Wetter/Provider-Platzhalter (D-UI-CORE-002 A). Gregor: E-Mail-Einstieg. */
export function PinEingabe({ laenge, meldung, onZiffer, onLoeschen, onNeu, onEmailAnmeldung }: PinEingabeProps) {
  return (
    <div className="kr-login"><div className="kr-login-karte">
      <div className="kr-login-marke"><div className="kr-marke"><span className="kr-logo">GK</span><span className="kr-marke-name">KREILE</span></div></div>
      <div className="kr-login-pin">
        <h1 className="kr-login-titel">Code eingeben</h1>
        <div className="kr-pin-punkte" aria-label={laenge + ' von 4 Ziffern'}>{[0, 1, 2, 3].map(n => <span key={n} className={laenge > n ? 'kr-pin-punkt kr-pin-punkt--an' : 'kr-pin-punkt'} />)}</div>
        <div className="kr-pin-meldung" role="alert">{meldung}</div>
        <div className="kr-tastatur">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(z => <button key={z} type="button" className="kr-taste" onClick={() => onZiffer(z)}>{z}</button>)}
          <button type="button" className="kr-taste kr-taste--klein" onClick={onLoeschen}>Löschen</button>
          <button type="button" className="kr-taste" onClick={() => onZiffer('0')}>0</button>
          <button type="button" className="kr-taste kr-taste--klein" onClick={onNeu}>Neu</button>
        </div>
        {onEmailAnmeldung && <Button art="leise" text="Admin-Anmeldung per E-Mail" onClick={onEmailAnmeldung} />}
      </div>
    </div></div>
  );
}
