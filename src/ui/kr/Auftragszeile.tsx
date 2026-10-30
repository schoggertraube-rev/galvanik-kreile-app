import { Zeile } from './Zeile';
import { Chip } from './Chip';
import { Button } from './Button';
import { Icon } from './Icon';
import type { Ton } from './typen';
export interface AuftragszeileProps {
  id: string; kundeKurz: string; titel: string; /** z. B. „Verchromen · 4 Teile · Galvanik“ */ meta?: string;
  ton?: 'ok' | 'warn' | 'rot' | 'info'; status?: { text: string; ton?: Ton };
  aktion?: { text: string; onClick: () => void }; karte?: boolean; onOeffnen?: () => void;
}
export function Auftragszeile({ id, kundeKurz, titel, meta, ton, status, aktion, karte, onOeffnen }: AuftragszeileProps) {
  return <Zeile punkt={ton} id={id} titel={kundeKurz + ' · ' + titel} meta={meta} karte={karte} onClick={aktion ? undefined : onOeffnen}
    seite={<>{status && <Chip text={status.text} ton={status.ton} />}{aktion && <Button art="sekundaer" text={aktion.text} onClick={aktion.onClick} />}{onOeffnen && !aktion && <Icon name="arrow" />}</>} />;
}
