'use client';

import {Children,type ReactNode} from 'react';
import {Icon} from './Icon';

export interface VertiefungProps {
  titel:string;
  offen:boolean;
  laden:boolean;
  deaktiviert:boolean;
  onOffen:(offen:boolean)=>void;
  children:ReactNode;
}

/** S19: v10's fold/summary/span/chev/fold-in, e.g. message history at 1663. */
export function Vertiefung({titel,offen,laden,deaktiviert,onOffen,children}:VertiefungProps) {
  if(Children.toArray(children).length===0||(typeof children==='string'&&!children.trim()))return null;
  const blocked=laden||deaktiviert;
  return <details className="fold" data-spec-id="baustein.vertiefung" open={offen}
    aria-busy={laden} onToggle={event=>{
      if(!blocked&&event.currentTarget.open!==offen)onOffen(event.currentTarget.open);
    }}>
    <summary aria-disabled={blocked} onClick={event=>{if(blocked)event.preventDefault();}}>
      <span>{titel}</span><Icon variant="vorfinal" name="chev"/>
    </summary>
    <div className="fold-in bk-links">{children}</div>
  </details>;
}
