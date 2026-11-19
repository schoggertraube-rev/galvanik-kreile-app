'use client';

import {useId} from 'react';
import {Button} from './Button';

export interface HauptaktionProps {
  /** Existing V45 command ID; the caller retains its real N5/rights boundary. */
  elementId: string;
  text: string;
  laden: boolean;
  gesperrt: boolean;
  /** The existing command's concrete reason, never a replacement error. */
  grund?: string;
  onAusloesen: () => void;
}

/**
 * S19 baustein.hauptaktion. v10 leadHTML's lead-acts/fact, using the existing
 * Button copy of v10 act(). No command, optimistic success or second logger.
 * Loading preserves the actual label and object context supplied by the caller.
 */
export function Hauptaktion({elementId,text,laden,gesperrt,grund,onAusloesen}:HauptaktionProps) {
  const reasonId=useId();
  return <section data-spec-id="baustein.hauptaktion" aria-busy={laden}>
    <div className="lead-acts">
      <Button art="primaer" text={text} data-spec-id={elementId}
        disabled={laden||gesperrt} aria-busy={laden}
        aria-describedby={gesperrt&&grund?reasonId:undefined}
        onClick={onAusloesen}/>
    </div>
    {gesperrt&&grund?<p id={reasonId} className="fact">{grund}</p>:null}
  </section>;
}
