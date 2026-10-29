import { Icon } from './Icon';
import { MitZustand } from './Zustand';
import type { DatenZustand, ZustandTexte } from './typen';
export interface WipMengeProps { anzahl: number; meta?: string; onOeffnen: () => void; zustand?: DatenZustand; texte?: ZustandTexte; }
/** „In Arbeit“ als EINE ruhige Menge. Keine Riesenzahl (G5). Keine Bäder/Stationen (D-ARCH-010). */
export function WipMenge({ anzahl, meta, onOeffnen, zustand = 'daten', texte }: WipMengeProps) {
  return (
    <MitZustand zustand={zustand} texte={{ titel: 'In Arbeit', leerText: 'Nichts in Arbeit.', ...texte }}>
      <button type="button" className="kr-wip" onClick={onOeffnen}><Icon name="flask" />
        <span><span className="kr-wip-t">In Arbeit<span className="kr-wip-zahl">{anzahl}</span></span>{meta && <span className="kr-wip-s" style={{ display: 'block' }}>{meta}</span>}</span>
        <span className="kr-wip-go"><Icon name="arrow" /></span></button>
    </MitZustand>
  );
}
