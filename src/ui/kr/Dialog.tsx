'use client';
import { useEffect, useLayoutEffect, useId, useRef, useState, type CSSProperties,type ReactNode } from 'react';
import {useVorfinalStyle} from '@/ui/useVorfinalStyle';
import {dialog as dialogMoment} from '@/ui/motion';
import {V45_TEXT} from '@/ui/situationCatalog';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import { cx } from './typen';
import { useKrGeraet } from './AppShell';
export type DialogMeldung = { text: string; ton: 'fehler' | 'erfolg'; specId?:string };
export interface DialogProps { titel: string; unterzeile?: ReactNode; icon?: IconName; groesse?: 'normal' | 'breit' | 'schmal' | 'karte' | 'werkbank'; onSchliessen: () => void; vorSchliessen?: () => boolean; onZurueck?: () => void; schliessenSpecId?: string; fuss?: ReactNode; meldung?: DialogMeldung | null; children: ReactNode; vorfinalForm?:'overlay'; beschaeftigt?:boolean; dataSpecId?:string; oeffner?:HTMLElement|null; }
export function isTopDialog(element: HTMLElement | null) {
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].filter(dialog => !dialog.closest('[hidden], [aria-hidden="true"]') && getComputedStyle(dialog).display !== 'none');
  return dialogs.at(-1) === element;
}
/** Der Seitenname bleibt die Überschrift; ein Modus steht als Unterzeile darunter. */
/** Schließt mit umgekehrter Bewegung (180 ms), dann onSchliessen – kein hartes Verschwinden. */
export function Dialog({ titel, unterzeile, icon = 'file', groesse = 'normal', onSchliessen: sofort, vorSchliessen, onZurueck, schliessenSpecId, fuss, meldung, children,vorfinalForm,beschaeftigt=false,dataSpecId,oeffner }: DialogProps) {
  const [zu, setZu] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  // Capture before child commit/autofocus or an immediate first edit can move
  // focus inside this dialog; the passive effect is too late for that origin.
  const openerRef=useRef<HTMLElement|null>(oeffner===undefined?(typeof document!=='undefined'&&document.activeElement instanceof HTMLElement?document.activeElement:null):oeffner),closingRef=useRef(false);
  const vorfinal=useVorfinalStyle(),titelId=useId(),sourceOverlay=vorfinal&&vorfinalForm==='overlay';
  // The existing dialog owns focus as well as Esc. Source v10 openOv's order:
  // autofocus, main action, close. No second overlay stack/keyboard listener.
  useEffect(()=>{
    if(!sourceOverlay)return;
    const previous=openerRef.current;
    const dialog=dialogRef.current;
    if(dialog)dialogMoment.oeffnen(dialog,previous!==document.body?previous:null);
    (dialog?.querySelector<HTMLElement>('[autofocus]:not(:disabled)')??dialog?.querySelector<HTMLElement>('.act:not(:disabled)')??dialog?.querySelector<HTMLElement>('[data-overlay-close]:not(:disabled)')??dialog)?.focus();
    return()=>{if(previous?.isConnected)previous.focus();};
  },[sourceOverlay]);
  const onSchliessen = () => {
    if(zu||sourceOverlay&&closingRef.current||vorSchliessen?.()===false)return;
    if(sourceOverlay)closingRef.current=true;
    if(sourceOverlay&&dialogRef.current){
      setZu(true);
      dialogMoment.zurueck(dialogRef.current,openerRef.current,sofort);
      return;
    }
    const still=matchMedia('(prefers-reduced-motion:reduce)').matches;if(still)return sofort();
    setZu(true);
    setTimeout(sofort,190);
  };
  useLayoutEffect(() => { const h = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (!isTopDialog(dialogRef.current)) return;
    e.preventDefault(); e.stopImmediatePropagation(); onSchliessen();
  }; addEventListener('keydown', h); return () => removeEventListener('keydown', h); });
  if(sourceOverlay)return <div className="ov on" data-closing={zu} style={{pointerEvents:zu?'none':undefined}}
    onClick={event=>{if(event.target===event.currentTarget)onSchliessen();}}>
    <section ref={dialogRef} className="ov-box" role="dialog" aria-modal="true" aria-labelledby={titelId} tabIndex={-1}
      aria-busy={beschaeftigt} data-spec-id={dataSpecId}
      style={{'--ovw':groesse==='schmal'?'560px':'640px'} as CSSProperties}>
      <div className="ov-in" data-glass="sheet"><div data-overlay-body style={{position:'relative'}}>
        <header className="ov-head small">
          {onZurueck?<Button vorfinalForm="icon" icon="back" label={V45_TEXT.common$back} disabled={beschaeftigt} onClick={onZurueck}/>:null}
          <div><h2 id={titelId}>{titel}</h2>{unterzeile?<p>{unterzeile}</p>:null}</div>
          <Button vorfinalForm="icon" icon="x" label={V45_TEXT.common$close} disabled={beschaeftigt}
            data-overlay-close data-spec-id={schliessenSpecId} onClick={onSchliessen}/>
        </header>
        {meldung?<DialogAktionsmeldung meldung={meldung}/>:null}{children}
        {fuss?<div className="lead-acts" inert={beschaeftigt}>{fuss}</div>:null}
      </div></div>
    </section>
  </div>;
  if (groesse === 'karte') return <div className={zu ? 'kr-ebene kr-ebene--zu' : 'kr-ebene'} style={{pointerEvents:'auto'}} onClick={e => e.target === e.currentTarget && onSchliessen()}><section ref={dialogRef} className="kr-dialog kr-dialog--karte" role="dialog" aria-modal="true" aria-label={titel}><div className="kr-streifen" />{children}</section></div>;
  return (
    <div className={zu ? 'kr-ebene kr-ebene--zu' : 'kr-ebene'} style={{pointerEvents:'auto'}} onClick={e => e.target === e.currentTarget && onSchliessen()}>
      <section ref={dialogRef} className={cx('kr-dialog', groesse !== 'normal' && 'kr-dialog--' + groesse)} role="dialog" aria-modal="true" aria-label={titel}>
        <header className="kr-dialog-kopf">{onZurueck && <Button art="leise" icon="back" label="Zurück" onClick={onZurueck} />}<span className="kr-dialog-ic"><Icon name={icon} /></span><h2 className="kr-dialog-titel">{titel}{unterzeile ? <span className="r51-modus">{unterzeile}</span> : null}</h2><Button data-spec-id={schliessenSpecId} art="leise" icon="x" label="Schließen" onClick={onSchliessen} /></header>
        <div className="kr-dialog-inhalt">{meldung ? <DialogAktionsmeldung meldung={meldung} /> : null}{children}</div>
        {fuss && <footer className="kr-dialog-fuss">{fuss}</footer>}
      </section>
    </div>
  );
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
