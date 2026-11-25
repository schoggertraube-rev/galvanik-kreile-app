'use client';

import {useEffect,useRef,useState,type ReactNode} from 'react';
import {V45_TEXT} from '@/ui/situationCatalog';
import {Icon,type IconName} from './Icon';
import {Button} from './Button';
import {cx} from './typen';
import {useKrGeraet} from './AppShell';
import {GlasDialog,isTopGlassDialog,type GlasDialogProps} from './design-final/GlasDialog';

export type DialogMeldung = { text: string; ton: 'fehler' | 'erfolg'; specId?:string };
export interface DialogProps { titel: string; unterzeile?: ReactNode; icon?: IconName; groesse?: 'normal' | 'breit' | 'schmal' | 'karte' | 'werkbank'; onSchliessen: () => void; vorSchliessen?: () => boolean; onZurueck?: () => void; schliessenSpecId?: string; fuss?: ReactNode; meldung?: DialogMeldung | null; children: ReactNode; vorfinalForm?:'overlay'; beschaeftigt?:boolean; dataSpecId?:string; oeffner?:HTMLElement|null; }

export const isTopDialog = isTopGlassDialog;

const groessen = {
  normal:'normal', breit:'breit', schmal:'kompakt', karte:'akte', werkbank:'antwort',
} satisfies Record<NonNullable<DialogProps['groesse']>, GlasDialogProps['groesse']>;

export function Dialog({titel,unterzeile,icon='file',groesse='normal',onSchliessen,vorSchliessen,onZurueck,
  schliessenSpecId,fuss,meldung,children,beschaeftigt=false,dataSpecId,oeffner}:DialogProps) {
  const [offen,setOffen]=useState(true);
  const geraet=useKrGeraet();
  const [opener]=useState(()=>oeffner===undefined
    ? typeof document!=='undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
    : oeffner);
  return <GlasDialog offen={offen} titel={titel} beschreibung={unterzeile} groesse={groessen[groesse]}
    ansicht={geraet==='handy'?'blatt':groesse==='karte'?'objekt':'fenster'}
    schliessenText={V45_TEXT.common$close} schliessenSymbol={<Icon name="x"/>} schliessenSpecId={schliessenSpecId}
    schliesstGesperrt={beschaeftigt} beschaeftigt={beschaeftigt} dataSpecId={dataSpecId} oeffner={opener}
    onSchliessen={()=>{if(vorSchliessen?.()!==false)setOffen(false);}} onGeschlossen={onSchliessen}
    kopfSymbol={<Icon name={icon}/>} kopfAktionen={onZurueck && <Button art="leise" icon="back"
      label={V45_TEXT.common$back} disabled={beschaeftigt} onClick={onZurueck}/>} fuss={fuss}>
    {meldung && <DialogAktionsmeldung meldung={meldung}/>}
    {children}
  </GlasDialog>;
}

export function DialogAktionsmeldung({ meldung }: { meldung: DialogMeldung }) {
  return <div data-spec-id={meldung.specId} role="status" aria-live="polite"><Hinweis ton={meldung.ton === 'erfolg' ? 'ok' : 'warn'} icon={meldung.ton === 'erfolg' ? 'check' : 'alert'}>{meldung.text}</Hinweis></div>;
}
export function Schritte({ aktuell, gesamt }: { aktuell: number; gesamt: number }) {
  return <div className="kr-schritte" aria-label={'Schritt ' + (aktuell + 1) + ' von ' + gesamt}>{Array.from({ length: gesamt }, (_, n) => <span key={n} className={n <= aktuell ? 'an' : undefined} />)}</div>;
}
export function Hinweis({ ton, icon = 'alert', children }: { ton?: 'warn' | 'ok'; icon?: IconName; children: ReactNode }) {
  return <div className={cx('kr-hinweis', ton && 'kr-hinweis--' + ton)}><Icon name={icon} />{children}</div>;
}
export interface SchrittNavProps { schritte: string[]; aktuell: number; /** nur bereits erreichte Schritte sind anklickbar */ erreicht: number; onSchritt: (n: number) => void; }
/** Klickbare Schrittleiste für mehrstufige Abläufe (z. B. Neuer Eingang) – zurückspringen ohne Datenverlust */
export function SchrittNav({ schritte, aktuell, erreicht, onSchritt }: SchrittNavProps) {
  return <nav className="kr-schritt-nav" aria-label="Schritte">{schritte.map((s, n) => (
    <button key={s} type="button" className={n <= aktuell ? 'an' : undefined} aria-current={n === aktuell ? 'step' : undefined} disabled={n > erreicht || n === aktuell} onClick={() => onSchritt(n)}><b>{n + 1}</b>{s}</button>))}</nav>;
}
export interface AbschnittNavProps { abschnitte: string[]; aktuell: number; onAbschnitt: (n: number) => void; }
/** V1.1 B6: Desktop/Tablet – Neuer Eingang auf einer Seite; Schrittleiste wird Sprungmarke (alle Abschnitte erreichbar). Handy: weiter SchrittNav. */
export function AbschnittNav({ abschnitte, aktuell, onAbschnitt }: AbschnittNavProps) {
  return <div className="kr-eingang-nav"><nav className="kr-schritt-nav" aria-label="Abschnitte">{abschnitte.map((s, n) => (
    <button key={s} type="button" className={n <= aktuell ? 'an' : undefined} aria-current={n === aktuell ? 'step' : undefined} onClick={() => onAbschnitt(n)}><b>{n + 1}</b>{s}</button>))}</nav></div>;
}
export interface AbschnittProps { nr: number; label: string; dataSpecId?: string; children: ReactNode; }
/** Abschnitt ohne eigene Überschrift (§6.3) – Name steht nur in der AbschnittNav; aria-label für Screenreader */
export function Abschnitt({ nr, label, dataSpecId, children }: AbschnittProps) {
  return <section className="kr-abschnitt" data-abschnitt={nr} data-spec-id={dataSpecId} aria-label={label}>{children}</section>;
}

export interface RueckfrageProps {
  felder: readonly string[];
  hauptaktion?: {text:string;lauftext:string;ausfuehren:()=>void};
  entwurfGeplant?: boolean;
  onEntwurf?: ()=>void;
  beschaeftigt: boolean;
  fehler?: string|null;
  onVerwerfen:()=>void;
  onWeiter:()=>void;
}
/** 3.6: Enter führt dieselbe Hauptaktion wie der Knopf aus, Esc schließt nur diese Ebene. */
export function Rueckfrage({felder,hauptaktion,entwurfGeplant=false,onEntwurf,beschaeftigt,fehler,onVerwerfen,onWeiter}:RueckfrageProps){
  const geraet=useKrGeraet();
  const cardStyle={minHeight:geraet==='desktop'?90:geraet==='tablet'?71:68,flexDirection:'column' as const,whiteSpace:'normal' as const};
  const content=useRef<HTMLDivElement>(null);
  const hatHaupt=Boolean(hauptaktion),onHaupt=hauptaktion?.ausfuehren;
  useEffect(()=>{
    const dialog=content.current?.closest<HTMLElement>('[role="dialog"]')??null;
    const handle=(event:KeyboardEvent)=>{if(event.key!=="Enter"||beschaeftigt||!onHaupt||!isTopDialog(dialog))return;event.preventDefault();event.stopImmediatePropagation();onHaupt()};
    window.addEventListener("keydown",handle);return()=>window.removeEventListener("keydown",handle);
  },[beschaeftigt,onHaupt]);
  useEffect(()=>{if(!beschaeftigt)content.current?.closest('[role="dialog"]')?.querySelector<HTMLElement>(hatHaupt?'[data-spec-id="entwurf.speichern"]':'[data-spec-id="entwurf.weiter-bearbeiten"]')?.focus()},[beschaeftigt,hatHaupt]);
  const changed=felder.slice(0,4).join(", ")+(felder.length>4?" … und "+(felder.length-4)+" weitere":"");
  return <Dialog titel="Änderungen nicht gespeichert" icon="file" groesse="schmal" onSchliessen={onWeiter} vorSchliessen={()=>!beschaeftigt}
    meldung={fehler?{text:fehler,ton:"fehler"}:null}
    fuss={<div className="kr-form" style={{width:'100%',gridTemplateColumns:geraet==='desktop'?'repeat(3,minmax(0,1fr))':'1fr'}}>
      {hauptaktion?<Button style={cardStyle} data-spec-id="entwurf.speichern" art="erledigen" icon="check" text={beschaeftigt?hauptaktion.lauftext:hauptaktion.text} disabled={beschaeftigt} onClick={hauptaktion.ausfuehren}/>:onEntwurf?<Button style={cardStyle} data-spec-id="entwurf.entwurf-behalten" icon="file" text={beschaeftigt?"Wird gespeichert …":"Als Entwurf ablegen"} disabled={beschaeftigt} onClick={onEntwurf}/>:entwurfGeplant?<Button style={cardStyle} data-spec-id="entwurf.entwurf-behalten" icon="file" text="Als Entwurf ablegen · geplant · Stufe 2" disabled/>:null}
      <Button style={{...cardStyle,background:'var(--ral-bg)',color:'var(--ral-fg)',borderColor:'var(--ral)'}} data-spec-id="entwurf.verwerfen" icon="x" text="Verwerfen" disabled={beschaeftigt} onClick={onVerwerfen}/>
      <Button style={cardStyle} data-spec-id="entwurf.weiter-bearbeiten" icon="edit" text="Weiter bearbeiten" disabled={beschaeftigt} onClick={onWeiter}/>
    </div>}><div ref={content} data-spec-id="entwurf"><p>Geändert: {changed} – speichern, verwerfen oder weiter bearbeiten?</p></div></Dialog>;
}
