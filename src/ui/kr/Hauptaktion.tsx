'use client';

import {useId} from 'react';
import {Button} from './Button';

/** A missing binding has an explicit source reason, never a no-op command. */
export type Fachaktion={gesperrt:boolean}&(
  |{onAusloesen:()=>void;grund?:string}
  |{onAusloesen:null;grund:string}
);
export type HauptaktionProps = {
  /** Existing V45 command ID; the caller retains its real N5/rights boundary. */
  elementId: string;
  text: string;
  laden: boolean;
}&Fachaktion;

/**
 * S19 baustein.hauptaktion. v10 leadHTML's lead-acts/fact, using the existing
 * Button copy of v10 act(). No command, optimistic success or second logger.
 * Loading preserves the actual label and object context supplied by the caller.
 */
export function Hauptaktion({elementId,text,laden,gesperrt,grund,onAusloesen}:HauptaktionProps) {
  const reasonId=useId();
  const blocked=laden||gesperrt||onAusloesen===null;
  const reasonVisible=(gesperrt||onAusloesen===null)&&Boolean(grund);
  return <section data-spec-id="baustein.hauptaktion" aria-busy={laden}>
    <div className="lead-acts">
      <Button art="primaer" text={text} data-spec-id={elementId}
        disabled={blocked} aria-busy={laden}
        aria-describedby={reasonVisible?reasonId:undefined}
        onClick={onAusloesen===null?undefined:onAusloesen}/>
    </div>
    {reasonVisible?<p id={reasonId} className="fact">{grund}</p>:null}
  </section>;
}
