'use client';

import {V45_TEXT} from '@/ui/situationCatalog';
import {Button} from './Button';
import {Icon} from './Icon';

const ERROR_TEXT={offline:V45_TEXT.error$offline,server:V45_TEXT.error$server,
  conflict:V45_TEXT.error$conflict,permission:V45_TEXT.error$permission,
  empty:V45_TEXT.error$empty,mailbox:V45_TEXT.error$mailbox,
  send_unknown:V45_TEXT.error$send_unknown,save:V45_TEXT.error$save};
export type FehlerSituation=keyof typeof ERROR_TEXT;
export interface FehlerProps {
  situation:FehlerSituation;
  gegenstand:string;
  /** Existing catalog exit wording, not a raw Error.message. */
  ausweg:string;
  objektId:string;
  laden:boolean;
  deaktiviert:boolean;
  aktion:{id:string;text:string;onAusloesen:()=>void};
}

/** V45 FEHLER_BAUSTEIN/A.errorBlock semantics, v10 warnline + btn2 DOM/style. */
export function Fehler({situation,gegenstand,ausweg,objektId,laden,deaktiviert,aktion}:FehlerProps) {
  return <section data-spec-id="baustein.fehler" data-object-id={objektId} aria-busy={laden}>
    <p className="warnline" data-tone={situation==='offline'?'calm':'warn'}
      data-spec-id={'fehler.'+situation} role="status">
      <Icon variant="vorfinal" name={situation==='offline'?'clock':'alert'}/>
      <span>{ERROR_TEXT[situation]({gegenstand,ausweg})}</span>
    </p>
    <div className="lead-acts"><Button vorfinalForm="pill" text={aktion.text}
      data-spec-id={aktion.id} disabled={laden||deaktiviert} onClick={aktion.onAusloesen}/></div>
  </section>;
}
