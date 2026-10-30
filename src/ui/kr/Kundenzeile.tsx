import { Zeile } from './Zeile';
import { Chip } from './Chip';
import { Icon } from './Icon';
export interface KundenzeileProps { kuerzel: string; name: string; /** z. B. „20095 Hamburg · 2 aktive Aufträge“ */ meta?: string; rechnungAufZiel?: boolean; karte?: boolean; onOeffnen?: () => void; }
export function Kundenzeile({ kuerzel, name, meta, rechnungAufZiel, karte, onOeffnen }: KundenzeileProps) {
  return <Zeile vorne={<span className="kr-av">{kuerzel}</span>} titel={name} meta={meta} karte={karte} onClick={onOeffnen}
    seite={<>{rechnungAufZiel && <Chip text="Rechnung auf Ziel" ton="ok" />}{onOeffnen && <Icon name="arrow" />}</>} />;
}
