import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { MitZustand } from './Zustand';
import type { DatenZustand, ZustandTexte } from './typen';
export interface BuendelVorschlagProps { titel: ReactNode; meta?: string; aktion: { text: string; onClick: () => void }; zustand?: DatenZustand; texte?: ZustandTexte; }
/** Proaktiver Bündel-Vorschlag (z. B. Zink), Phillip V4 */
export function BuendelVorschlag({ titel, meta, aktion, zustand = 'daten', texte }: BuendelVorschlagProps) {
  return (
    <MitZustand zustand={zustand} texte={{ titel: 'Bündel-Vorschlag', leerText: 'Kein Bündel möglich.', ...texte }}>
      <div className="kr-buendel"><Icon name="layers" /><div><div className="kr-buendel-t">{titel}</div>{meta && <div className="kr-buendel-s">{meta}</div>}</div>
        <Button art="sekundaer" icon="layers" text={aktion.text} onClick={aktion.onClick} /></div>
    </MitZustand>
  );
}
