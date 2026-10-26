import { Icon, type IconName } from './Icon';
import { Punkt } from './Chip';
import type { HandlungsArt } from './typen';
export type GesundStatus = 'ok' | 'warn' | 'kritisch' | 'aufbau';
export interface GesundAnzeige { key: string; titel: string; icon: IconName; status: GesundStatus; /** ein Wort, keine Zahl (OE-2609-22: keine Kennzahl-Kacheln) */ zustand?: string; onOeffnen?: () => void; }
export interface LageleisteProps {
  /** offene Punkte je Art – aufgeschobene zählen mit, delegierte nicht (Owner 2026-09-26) */
  zaehler: Record<HandlungsArt, number>;
  filter: HandlungsArt | 'alle'; onFilter: (f: HandlungsArt | 'alle') => void;
  /** Firmengesundheit (USP): Termintreue · Liquidität 30 Tage (OE-2609-21/23). Phillip: nur Termintreue, nie Geld. */
  gesund: GesundAnzeige[];
}
const ARTEN: Array<[HandlungsArt, string, 'rot' | 'info' | 'warn']> = [['konflikt', 'Konflikte', 'rot'], ['entscheidung', 'Entscheidungen', 'info'], ['warnung', 'Warnungen', 'warn']];
/** „30 Tage“ entfällt auf dem Handy (CSS .kr-gesund-z) */
const kurz = (t: string) => t.includes(' 30 Tage') ? <>{t.replace(' 30 Tage', '')}<span className="kr-gesund-z"> 30 Tage</span></> : t;
/** Arten ohne offenen Punkt werden nicht gezeigt. Erste Zeile jeder Startseite: Kontrolle (Filter über den Handlungsbedarf) + Gesundheit der Firma */
export function Lageleiste({ zaehler, filter, onFilter, gesund }: LageleisteProps) {
  return (
    <div className="kr-lage" role="region" aria-label="Lage">
      <div className="kr-lage-filter">{ARTEN.filter(([art]) => zaehler[art] > 0).map(([art, text, ton]) => (
        <button key={art} type="button" className="kr-lage-f" aria-pressed={filter === art} onClick={() => onFilter(filter === art ? 'alle' : art)}>
          <Punkt ton={ton} /><b>{zaehler[art]}</b><span className="kr-lage-lbl">{text}</span></button>))}</div>
      {gesund.length > 0 && <div className="kr-lage-gesund">{gesund.map(g => g.status === 'aufbau'
        ? <span key={g.key} className="kr-gesund kr-gesund--aufbau" aria-disabled="true"><Icon name={g.icon} />{kurz(g.titel)}<span className="kr-ausgrau-tag">In Aufbau</span></span>
        : <button key={g.key} type="button" className={'kr-gesund kr-gesund--' + g.status} onClick={g.onOeffnen}><Icon name={g.icon} />{kurz(g.titel)}<span className="kr-gesund-s">· {g.zustand}</span></button>)}</div>}
    </div>
  );
}
