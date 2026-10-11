import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { MitZustand } from './Zustand';
import type { DatenZustand, ZustandTexte } from './typen';
export interface KachelProps {
  titel: string; icon?: IconName; iconTon?: 'ok' | 'info' | 'warn';
  /** Anzahl – nur hier ODER als Badge, nie beides (§6.5). Max. 16px. */ zahl?: number;
  fuss?: { text: string; onClick: () => void }; zustand?: DatenZustand; texte?: ZustandTexte; children?: ReactNode;
}
/** Tagesüberblick-Kachel: Höhe = Inhalt, keine feste Höhe, keine Erklärzeile */
export function Kachel({ titel, icon, iconTon, zahl, fuss, zustand = 'daten', texte, children }: KachelProps) {
  const daten = zustand === 'daten';
  return (
    <section className="kr-kachel">
      <header className="kr-kachel-kopf">
        <h2 className="kr-kachel-titel">{icon && <span className={iconTon ? 'kr-kachel-ic kr-kachel-ic--' + iconTon : 'kr-kachel-ic'}><Icon name={icon} /></span>}{titel}</h2>
        {daten && zahl != null && <span className="kr-kachel-zahl">{zahl}</span>}
      </header>
      <div className="kr-kachel-inhalt"><MitZustand zustand={zustand} texte={{ titel, ...texte }}>{children}</MitZustand></div>
      {daten && fuss && <button type="button" className="kr-kachel-fuss" onClick={fuss.onClick}>{fuss.text} <Icon name="arrow" /></button>}
    </section>
  );
}
