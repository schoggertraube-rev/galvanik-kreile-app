'use client';

import type {ReactNode} from 'react';
import type {SuchTreffer} from './Suche';

export interface SuchtrefferProps {
  treffer:readonly SuchTreffer[];
  selectedKey:string|null;
  laden:boolean;
  deaktiviert:boolean;
  /** Existing empty/permission situation with its real exit, never invented here. */
  leer:ReactNode;
}

/**
 * S19: v10 renderSR's sr/result/dot/b/small/note markup (2714).
 * Search, rights, confidence and navigation remain the existing caller's ports.
 * No truncation or automatic opening of an ambiguous/first result.
 */
export function Suchtreffer({treffer,selectedKey,laden,deaktiviert,leer}:SuchtrefferProps) {
  return <div className="sr" data-spec-id="baustein.suchtreffer" aria-busy={laden}>
    {treffer.length?treffer.map(treffer=><button key={treffer.key} type="button"
      className={treffer.key===selectedKey?'result sel':'result'} tabIndex={-1}
      data-result-key={treffer.key} disabled={laden||deaktiviert} onClick={treffer.onOeffnen}>
      <i className="dot"/><span><b>{treffer.id?`${treffer.id} `:null}{treffer.titel}</b><small>{treffer.grund}</small></span>
      <span className="note">{treffer.quelle}</span>
    </button>):leer}
  </div>;
}
