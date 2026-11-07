import { Zeile } from './Zeile';
import { Chip } from './Chip';
import { Icon } from './Icon';
export interface KundenzeileProps { kuerzel: string; name: string; /** z. B. „20095 Hamburg · 2 aktive Aufträge“ */ meta?: string; hinweis?:boolean; rechnungAufZiel?: boolean; karte?: boolean; onOeffnen?: () => void; }
export function Kundenzeile({ kuerzel, name, meta, hinweis=false, rechnungAufZiel, karte, onOeffnen }: KundenzeileProps) {
  return <Zeile vorne={<span className="kr-av" style={hinweis?{position:'relative'}:undefined}>{kuerzel}{hinweis?<span style={{position:'absolute',right:-4,top:-4}} aria-label="Achtung"><Chip text="!" ton="warn"/></span>:null}</span>} titel={name} meta={meta} karte={karte} onClick={onOeffnen}
    seite={<>{rechnungAufZiel && <Chip text="Rechnung auf Ziel" ton="ok" />}{onOeffnen && <Icon name="arrow" />}</>} />;
}
