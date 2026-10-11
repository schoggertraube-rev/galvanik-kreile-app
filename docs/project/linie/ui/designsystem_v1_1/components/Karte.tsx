import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './typen';
import { Button } from './Button';
/** Auftragskarte V8 / Kundenkarte V2 – Rahmen im Overlay (eine Overlay-/Backstack-Wahrheit, D-UI-CORE-002 D) */
export interface KarteProps { kopf: ReactNode; kette?: ReactNode; haupt: ReactNode; rail?: ReactNode; fuss?: ReactNode; }
export function Karte({ kopf, kette, haupt, rail, fuss }: KarteProps) {
  return (
    <div className="kr-karte">
      <div className="kr-karte-scroll">{kopf}{kette && <div className="kr-kette-wrap">{kette}</div>}
        <div className="kr-karte-koerper"><div className="kr-karte-haupt">{haupt}</div>{rail && <div className="kr-karte-rail">{rail}</div>}</div></div>
      {fuss}
    </div>
  );
}
export interface KartenkopfProps { nummer: string; titel: string; sub?: string; meta?: ReactNode; termin?: ReactNode; onSchliessen: () => void; }
/** Kopf: Nummer · Titel (einzige Überschrift der Karte) · 1 Sub · Pills · Termin. Kunde nur hier (§6.5). */
export function Kartenkopf({ nummer, titel, sub, meta, termin, onSchliessen }: KartenkopfProps) {
  return (
    <header className="kr-kartenkopf">
      <div className="kr-kartenkopf-l"><div className="kr-karte-nr">{nummer}</div><h2 className="kr-karte-titel">{titel}</h2>{sub && <div className="kr-karte-sub">{sub}</div>}{meta && <div className="kr-karte-meta">{meta}</div>}</div>
      <div className="kr-kartenkopf-r"><button type="button" className="kr-schliessen" aria-label="Schließen" onClick={onSchliessen}><Icon name="x" /></button>{termin}</div>
    </header>
  );
}
export interface TerminBoxProps { relativ: string; datum: string; status?: ReactNode; zusatz?: ReactNode; dringend?: boolean; }
export function TerminBox({ relativ, datum, status, zusatz, dringend }: TerminBoxProps) {
  return <div className={cx('kr-termin', dringend && 'kr-termin--dringend')}><span className="kr-termin-c">{relativ}</span><span className="kr-termin-d">{datum} {status}</span>{zusatz && <span className="kr-termin-d">{zusatz}</span>}</div>;
}
export type SchrittStatus = 'erledigt' | 'aktiv' | 'bereit' | 'warten' | 'gesperrt';
export interface KettenSchritt { key: string; label: string; icon: IconName; status: SchrittStatus; sub?: string; /** Zahlungsschwelle = Gate, kein Ort */ schwelle?: boolean; frei?: boolean; onClick?: () => void;
  /** V1.1 B3: Fortschritt abgehakter Teile 0…1 (nur Balken, Zahl steht in sub – keine Doppelung) */ anteil?: number; }
/** Zustandskette = nur Ort im Haus: angenommen → Galvanik (ein Schritt, D-ARCH-010) → fertig → [Zahlung] → verschickt/abgeholt */
export function Zustandskette({ schritte }: { schritte: KettenSchritt[] }) {
  return (
    <div className="kr-kette">{schritte.map(s => {
      const cls = cx('kr-schritt', 'kr-schritt--' + s.status, s.schwelle && 'kr-schwelle', s.schwelle && s.frei && 'kr-schwelle--frei');
      const inner = <><span className="kr-schritt-dot"><Icon name={s.icon} /></span><span className="kr-schritt-lbl">{s.label}</span>{s.sub && <span className="kr-schritt-st">{s.sub}</span>}{s.anteil != null && <span className="kr-schritt-balken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.anteil * 100)}><i style={{ width: Math.round(s.anteil * 100) + '%' }} /></span>}</>;
      return s.onClick ? <button key={s.key} type="button" className={cls} onClick={s.onClick}>{inner}</button> : <div key={s.key} className={cls}>{inner}</div>;
    })}</div>
  );
}
export interface ZahlungsSchwelleProps { text: string; frei?: boolean; aktion?: ReactNode; }
export function ZahlungsSchwelle({ text, frei, aktion }: ZahlungsSchwelleProps) {
  return <div className={cx('kr-schwelle-zeile', frei && 'kr-schwelle-zeile--frei')}><span><Icon name={frei ? 'check' : 'lock'} /> {text}</span>{aktion}</div>;
}
export interface KartenBlockProps { label?: string; rechts?: ReactNode; children: ReactNode; }
/** Block in der Karte. Label nur, wenn der Inhalt nicht selbsterklärend ist (§6.3). */
export function KartenBlock({ label, rechts, children }: KartenBlockProps) {
  return <div className="kr-block">{label && <h3 className="kr-block-label">{label}{rechts}</h3>}{children}</div>;
}
export function NaechsteAktion({ titel, aktionen }: { titel: string; aktionen: ReactNode }) {
  return <div className="kr-naechste"><div className="kr-naechste-t">{titel}</div><div className="kr-naechste-a">{aktionen}</div></div>;
}
export interface TeilProps { nr: string; name: string; meta: string; fertig?: boolean; fotoFehlt?: boolean; status?: ReactNode; aktionen?: ReactNode;
  /** Owner 2026-09-27: Foto-Knopf direkt am Teil – Zustand festhalten, wird im Auftrag gespeichert */ onFoto?: () => void; /** Handy: nur Symbol */ geraet?: 'desktop' | 'tablet' | 'handy'; }
export function Teil({ nr, name, meta, fertig, fotoFehlt, status, aktionen, onFoto, geraet }: TeilProps) {
  return <div className={cx('kr-teil', fertig && 'kr-teil--fertig')}><span className={cx('kr-bild', fotoFehlt && 'kr-bild--leer')}><Icon name={fotoFehlt ? 'photooff' : 'photo'} /></span>
    <div style={{ minWidth: 0 }}><div className="kr-zeile-t" style={{ fontSize: 14 }}><span className="kr-id">{nr}</span>{name}{status}</div><div className="kr-zeile-s">{meta}</div></div><div style={{ display: 'flex', gap: 6 }}>{onFoto && <Button className="kr-teil-foto" art="sekundaer" icon="camera" text={geraet === 'handy' ? undefined : 'Foto'} label={'Foto zu ' + nr} onClick={onFoto} />}{aktionen}</div></div>;
}
export function Notiz({ text, bezug, autor }: { text: ReactNode; bezug: ReactNode; autor: string }) {
  return <div className="kr-notiz">{text}<div className="kr-notiz-m">{bezug} {autor}</div></div>;
}
export function Fakten({ zeilen }: { zeilen: Array<{ k: string; v: ReactNode; warn?: boolean }> }) {
  return <div className="kr-fakten">{zeilen.map(z => <div key={z.k} className="kr-fakt"><span>{z.k}</span><b style={z.warn ? { color: 'var(--ral-fg)' } : undefined}>{z.v}</b></div>)}</div>;
}
export interface VerlaufEintrag { key: string; zeit: string; text: string; icon?: IconName; ton?: 'ok' | 'warn'; }
export function Verlauf({ eintraege }: { eintraege: VerlaufEintrag[] }) {
  return <div className="kr-verlauf">{eintraege.map(e => <div key={e.key} className="kr-verlauf-el"><span className={cx('kr-verlauf-d', e.ton && 'kr-verlauf-d--' + e.ton)}><Icon name={e.icon ?? 'check'} /></span><div><div className="kr-verlauf-z">{e.zeit}</div><div className="kr-verlauf-t">{e.text}</div></div></div>)}</div>;
}
export interface SchnellAktion { key: string; text: string; icon: IconName; primaer?: boolean; erledigen?: boolean; onClick: () => void; }
/** Desktop: Raster in der Rail · Tablet/Handy: Kartendock unten (max. 5) */
export function Schnellaktionen({ aktionen, als }: { aktionen: SchnellAktion[]; als: 'raster' | 'dock' }) {
  const b = aktionen.map(a => <button key={a.key} type="button" className={cx('kr-qa', a.primaer && 'kr-qa--primaer', a.erledigen && 'kr-qa--erledigen')} onClick={a.onClick}><Icon name={a.icon} />{a.text}</button>);
  return als === 'raster' ? <div className="kr-qa-raster">{b}</div> : <nav className="kr-kartendock">{b.slice(0, 5)}</nav>;
}
