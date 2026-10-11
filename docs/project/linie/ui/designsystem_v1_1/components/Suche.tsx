import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Chip, Punkt } from './Chip';
import { MitZustand } from './Zustand';
import type { DatenZustand, ZustandTexte } from './typen';
export interface SuchKopfProps { platzhalter?: string; kbd?: string; onOeffnen: () => void; }
/** Suchfeld in der Kopfleiste – öffnet den Suchdialog (Strg K) */
export function SuchKopf({ platzhalter = 'Auftrag, Kunde oder Nummer suchen', kbd = 'Strg K', onOeffnen }: SuchKopfProps) {
  return <button type="button" className="kr-suche" onClick={onOeffnen}><Icon name="search" /><span className="kr-suche-ph">{platzhalter}</span><span className="kr-suche-kbd">{kbd}</span></button>;
}
export interface SuchFeldProps { wert: string; onWert: (v: string) => void; platzhalter?: string; autoFocus?: boolean; }
export function SuchFeld({ wert, onWert, platzhalter = 'Auftrag, Kunde, Teil, Notiz oder Dokument', autoFocus }: SuchFeldProps) {
  return <label className="kr-suchfeld"><Icon name="search" /><input value={wert} onChange={e => onWert(e.target.value)} placeholder={platzhalter} autoComplete="off" autoFocus={autoFocus} /></label>;
}
export interface SuchTreffer { key: string; id?: string; titel: string; /** Grund des Treffers, Fundstelle als <mark> */ grund: ReactNode; quelle: 'Auftrag' | 'Kunde' | 'Notiz' | 'Dokument' | 'KV' | 'Rechnung'; dringend?: boolean; onOeffnen: () => void; }
export interface SuchTrefferListeProps { treffer: SuchTreffer[]; zustand?: DatenZustand; texte?: ZustandTexte; }
export function SuchTrefferListe({ treffer, zustand = 'daten', texte }: SuchTrefferListeProps) {
  const z = zustand === 'daten' && treffer.length === 0 ? 'leer' : zustand;
  return (
    <MitZustand zustand={z} texte={{ titel: 'Suche', ...texte }}>
      <div className="kr-treffer-liste">{treffer.map(t => (
        <button key={t.key} type="button" className="kr-treffer" onClick={t.onOeffnen}>
          <Punkt ton={t.dringend ? 'rot' : undefined} />
          <span style={{ minWidth: 0 }}><span className="kr-treffer-t" style={{ display: 'block' }}>{t.id && <span className="kr-id">{t.id} </span>}{t.titel}</span><span className="kr-treffer-grund" style={{ display: 'block' }}>{t.grund}</span></span>
          <Chip text={t.quelle} ton="info" />
        </button>))}
      </div>
    </MitZustand>
  );
}
