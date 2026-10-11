import type { ReactNode } from 'react';
import { Chip } from './Chip';
import { MitZustand } from './Zustand';
import { cx, type DatenZustand, type ZustandTexte } from './typen';
export interface WochenTag { datum: string; label: string; heute?: boolean; eintraege: ReactNode[]; }
export interface TerminuebersichtProps { ansicht: 'woche' | 'monat'; tage: WochenTag[]; /** nur Monat: Wochentag des 1. (0 = Mo) */ versatz?: number; onTag?: (datum: string) => void; zustand?: DatenZustand; texte?: ZustandTexte; }
/** Ansicht INNERHALB „Aufträge“ – kein eigener Menüpunkt (D-UI-CORE-002, OE-2609-19). Kalender = Hintergrund. */
export function Terminuebersicht({ ansicht, tage, versatz = 0, onTag, zustand = 'daten', texte }: TerminuebersichtProps) {
  return (
    <MitZustand zustand={zustand} texte={{ titel: 'Terminübersicht', leerText: 'Keine Termine in diesem Zeitraum.', ...texte }}>
      {ansicht === 'woche' ? (
        <div className="kr-woche">{tage.map(t => (
          <section key={t.datum} className={cx('kr-tag', t.heute && 'kr-tag--heute')}><h2 className="kr-tag-kopf" style={{ margin: 0 }}><span>{t.label}</span><span>{t.eintraege.length || ''}</span></h2>
            <div className="kr-tag-inhalt">{t.eintraege.length ? t.eintraege : <div className="kr-zeile-s" style={{ padding: 10 }}>frei</div>}</div></section>))}</div>
      ) : (
        <div className="kr-monat">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(w => <div key={w} className="kr-monat-wt">{w}</div>)}
          {Array.from({ length: versatz }, (_, n) => <div key={'l' + n} className="kr-monat-tag kr-monat-tag--leer" />)}
          {tage.map((t, n) => <button key={t.datum} type="button" className={cx('kr-monat-tag', t.heute && 'kr-monat-tag--heute')} onClick={() => onTag?.(t.datum)}><span className="kr-monat-nr">{n + 1}</span>{t.eintraege.length > 0 && <Chip text={t.eintraege.length + (t.eintraege.length > 1 ? ' Termine' : ' Termin')} ton="info" />}</button>)}</div>
      )}
    </MitZustand>
  );
}
