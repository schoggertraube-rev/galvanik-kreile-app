'use client';

import {V45_TEXT} from '@/ui/situationCatalog';
import {Button} from './Button';

export interface TeilchipProps {
  auftragId:string;
  teilId:string;
  name:string;
  gut:number;
  menge:number;
  zustand:'offen'|'teilfertig'|'fertig';
  laden:boolean;
  deaktiviert:boolean;
  grund?:string;
  onOeffnen:(source:{auftragId:string;teilId:string})=>void;
}

/** V45 work.part/card_total and the original v10 btn2() control (1142).
 * The caller supplies the qualified quantities/state; opening never marks a
 * part done, invents a count or allocates another command key. */
export function Teilchip({auftragId,teilId,name,gut,menge,zustand,laden,deaktiviert,grund,onOeffnen}:TeilchipProps){
  return <Button vorfinalForm="pill"
    text={name+' · '+V45_TEXT.work$card_total({done:String(gut),total:String(menge)})}
    aria-label={V45_TEXT.work$card_part({part:name})}
    data-spec-id="work.part" data-baustein="baustein.teilchip"
    data-order-id={auftragId} data-object-id={teilId} data-zustand={zustand}
    disabled={laden||deaktiviert} aria-busy={laden} title={deaktiviert?grund:undefined}
    onClick={()=>onOeffnen({auftragId,teilId})}/>;
}
