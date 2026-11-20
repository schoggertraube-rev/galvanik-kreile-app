'use client';

import type {ReactNode} from 'react';
import {Dialog,type DialogProps} from './Dialog';

export interface OverlayProps {
  variante:'eingang'|'formular'|'kunde'|'auftrag'|'kv';
  bezugId:string;
  version:number;
  elternId:string|null;
  /** The actual invoking control from the existing click/navigation context.
   * Pointer clicks need not focus buttons (e.g. WebKit); never infer from body. */
  oeffner:HTMLElement|null;
  titel:string;
  laden:boolean;
  groesse?:DialogProps['groesse'];
  fehler:DialogProps['meldung'];
  vorSchliessen:()=>boolean;
  onSchliessen:()=>void;
  onZurueck?:()=>void;
  fuss?:ReactNode;
  children:ReactNode;
}

/** V45 baustein.overlay, source v10 ov/ov-box/ov-in. The actual caller keeps
 * its existing stack, dirty draft and command version; this view creates none. */
export function Overlay({variante,bezugId,version,elternId,oeffner,titel,laden,groesse,fehler,vorSchliessen,onSchliessen,onZurueck,fuss,children}:OverlayProps){
  const allowed=()=>!laden&&vorSchliessen();
  return <Dialog titel={titel} groesse={groesse} vorfinalForm="overlay" beschaeftigt={laden} oeffner={oeffner}
    dataSpecId="baustein.overlay" schliessenSpecId="overlay.close" meldung={fehler} fuss={fuss}
    vorSchliessen={allowed} onSchliessen={onSchliessen}
    onZurueck={onZurueck?()=>{if(allowed())onZurueck();}:undefined}>
    <div data-overlay-kind={variante} data-object-id={bezugId} data-source-version={version} data-parent-id={elternId??undefined}>{children}</div>
  </Dialog>;
}
