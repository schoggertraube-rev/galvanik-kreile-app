import type { ReactNode } from 'react';
import { Punkt, type PunktProps } from './Chip';
import { cx } from './typen';
export interface ZeileProps { vorne?: ReactNode; punkt?: PunktProps['ton'] | 'neutral'; id?: string; titel: string; meta?: string; seite?: ReactNode; /** eigenständige Karte statt Zeile in Kachel */ karte?: boolean; onClick?: () => void; }
/** Basis aller Listeneinträge: max. 2 Zeilen (Titel + 1 Meta), Aktion/Status rechts */
export function Zeile({ vorne, punkt, id, titel, meta, seite, karte, onClick }: ZeileProps) {
  const inhalt = (<>
    {vorne ?? <Punkt ton={punkt === 'neutral' ? undefined : punkt} />}
    <div className="kr-zeile-main"><div className="kr-zeile-t">{id && <span className="kr-id">{id}</span>}{titel}</div>{meta && <div className="kr-zeile-s">{meta}</div>}</div>
    <div className="kr-zeile-seite">{seite}</div>
  </>);
  const cls = cx('kr-zeile', karte && 'kr-zeile--karte');
  return onClick ? <button type="button" className={cls} onClick={onClick}>{inhalt}</button> : <div className={cls}>{inhalt}</div>;
}
