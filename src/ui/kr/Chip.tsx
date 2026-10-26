import { Icon, type IconName } from './Icon';
import type { Ton } from './typen';
export interface ChipProps { text: string; ton?: Ton; icon?: IconName; }
/** Tag-Chip / Status: Bedeutung über Farbe + Kurzlabel (§6.4) */
export function Chip({ text, ton, icon }: ChipProps) {
  return <span className={ton ? 'kr-chip kr-chip--' + ton : 'kr-chip'}>{icon && <Icon name={icon} />}{text}</span>;
}
export interface PunktProps { ton?: Exclude<Ton, 'marke' | 'teil' | 'dunkel'>; }
export function Punkt({ ton }: PunktProps) { return <span className={ton ? 'kr-punkt kr-punkt--' + ton : 'kr-punkt'} />; }
