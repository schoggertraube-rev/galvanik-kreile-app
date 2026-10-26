import { Icon, type IconName } from './Icon';
import { cx } from './typen';
export interface AusgrauProps {
  /** aufbau = Modul in Arbeit · klaerung = Entscheidung offen (OE-2609-04) */
  art: 'aufbau' | 'klaerung'; text: string; icon?: IconName;
  /** zeile (Standard) · knopf · nav (in der Seitenleiste) */
  variante?: 'zeile' | 'knopf' | 'nav';
}
/** Ausgegrautes ELEMENT – eine Zeile, gedämpft, nicht klickbar. Nie ganze Route/Fläche, nie „kommt bald“. */
export function Ausgrau({ art, text, icon, variante = 'zeile' }: AusgrauProps) {
  return (
    <div className={cx('kr-ausgrau', 'kr-ausgrau--' + art, variante !== 'zeile' && 'kr-ausgrau--' + variante)} aria-disabled="true">
      <Icon name={icon ?? (art === 'klaerung' ? 'clock' : 'lock')} />
      <span className="kr-ausgrau-text">{text}</span>
      <span className="kr-ausgrau-tag">{art === 'klaerung' ? 'In Klärung' : 'In Aufbau'}</span>
    </div>
  );
}
