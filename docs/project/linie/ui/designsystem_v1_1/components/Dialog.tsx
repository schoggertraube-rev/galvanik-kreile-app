'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import { cx } from './typen';
export interface DialogProps { titel: string; icon?: IconName; groesse?: 'normal' | 'breit' | 'schmal' | 'karte'; onSchliessen: () => void; onZurueck?: () => void; fuss?: ReactNode; children: ReactNode; }
/** Genau eine Überschrift, keine Unterzeile. Handy: Bottom-Sheet. Esc schließt. */
/** Schließt mit umgekehrter Bewegung (180 ms), dann onSchliessen – kein hartes Verschwinden. */
export function Dialog({ titel, icon = 'file', groesse = 'normal', onSchliessen: sofort, onZurueck, fuss, children }: DialogProps) {
  const [zu, setZu] = useState(false);
  const onSchliessen = () => { if (zu) return; const still = matchMedia('(prefers-reduced-motion:reduce)').matches; if (still) return sofort(); setZu(true); setTimeout(sofort, 190); };
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onSchliessen(); }; addEventListener('keydown', h); return () => removeEventListener('keydown', h); });
  if (groesse === 'karte') return <div className={zu ? 'kr-ebene kr-ebene--zu' : 'kr-ebene'} onClick={e => e.target === e.currentTarget && onSchliessen()}><section className="kr-dialog kr-dialog--karte" role="dialog" aria-modal="true" aria-label={titel}><div className="kr-streifen" />{children}</section></div>;
  return (
    <div className={zu ? 'kr-ebene kr-ebene--zu' : 'kr-ebene'} onClick={e => e.target === e.currentTarget && onSchliessen()}>
      <section className={cx('kr-dialog', groesse !== 'normal' && 'kr-dialog--' + groesse)} role="dialog" aria-modal="true" aria-label={titel}>
        <header className="kr-dialog-kopf">{onZurueck && <Button art="leise" icon="back" label="Zurück" onClick={onZurueck} />}<span className="kr-dialog-ic"><Icon name={icon} /></span><h2 className="kr-dialog-titel">{titel}</h2><Button art="leise" icon="x" label="Schließen" onClick={onSchliessen} /></header>
        <div className="kr-dialog-inhalt">{children}</div>
        {fuss && <footer className="kr-dialog-fuss">{fuss}</footer>}
      </section>
    </div>
  );
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
export interface AbschnittProps { nr: number; label: string; children: ReactNode; }
/** Abschnitt ohne eigene Überschrift (§6.3) – Name steht nur in der AbschnittNav; aria-label für Screenreader */
export function Abschnitt({ nr, label, children }: AbschnittProps) {
  return <section className="kr-abschnitt" data-abschnitt={nr} aria-label={label}>{children}</section>;
}
