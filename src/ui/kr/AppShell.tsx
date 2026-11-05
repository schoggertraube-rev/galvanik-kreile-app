'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { weiterMitEnter } from './tastatur';
import { Icon, type IconName } from './Icon';
import { Chip } from './Chip';
import { useHydrated } from '@/hooks/useHydrated';
import type { Geraet } from './typen';
import { cx } from './typen';
export type Bereich = 'tag' | 'nachrichten' | 'werkstatt' | 'auftraege' | 'kunden' | 'geld' | 'einstellungen';
export interface NavEintrag { id: Bereich; text: string; icon: IconName; badge?: { n: number; rot?: boolean }; }
export interface AppShellProps {
  geraet: Geraet;
  /** buero = Seitenleiste bzw. Dock · werkstatt = Kompaktkopf + feste Aktionsleiste */
  variante: 'buero' | 'werkstatt';
  aktiv: Bereich; kuerzel: string; datum?: ReactNode;
  /** vom Admin je Person gesperrte Bereiche (OE-2609-09) werden nicht angezeigt */
  ausgeblendet?: Bereich[]; badges?: Partial<Record<Bereich, { n: number; rot?: boolean }>>;
  suche: ReactNode; plus: ReactNode; neuigkeiten?:ReactNode;
  onNav: (b: Bereich | 'mehr') => void; onStart: () => void; onKonto: () => void;
  onNeuerEingang?: () => void; onWareRaus?: () => void;
  /** nur variante=werkstatt */ onAuftragOeffnen?: () => void; onMehrarbeit?: () => void; onFertigMelden?: () => void;
  ebene?: ReactNode; children: ReactNode;
}
const NAV: NavEintrag[] = [
  { id: 'tag', text: 'Der Tag', icon: 'sun' }, { id: 'nachrichten', text: 'Nachrichten', icon: 'mail' }, { id: 'werkstatt', text: 'Werkstatt', icon: 'flask' },
  { id: 'auftraege', text: 'Aufträge', icon: 'list' }, { id: 'kunden', text: 'Kunden & Kontakt', icon: 'users' },
  { id: 'geld', text: 'Geld & Rechnungen', icon: 'euro' }
];
const DOCK: Array<{ id: Bereich | 'mehr'; text: string; icon: IconName }> = [
  { id: 'tag', text: 'Der Tag', icon: 'sun' }, { id: 'auftraege', text: 'Aufträge', icon: 'list' }, { id: 'kunden', text: 'Kunden', icon: 'users' },
  { id: 'geld', text: 'Geld', icon: 'euro' }, { id: 'mehr', text: 'Mehr', icon: 'grid' }
];
/** Navigation nach Gerät, nicht nach Rolle. Aktionsleiste NUR variante=werkstatt – nie auf Büro-Desktop (G3/G4). Kalender-Menüpunkt erst nach M365-Abnahme. */
export function AppShell(p: AppShellProps) {
  const interactive = useHydrated();
  const kopf = (
    <header className="kr-kopf">
      <button type="button" className="kr-marke" aria-label="Startseite" disabled={!interactive} onClick={p.onStart}><span className="kr-logo">GK</span><span className="kr-marke-name">KREILE</span></button>
      {p.suche}
      {p.neuigkeiten}
      {p.datum && p.geraet === 'desktop' && <span className="kr-datum">{p.datum}</span>}
      {p.plus}
      <button type="button" className="kr-avatar" aria-label="Konto" disabled={!interactive} onClick={p.onKonto}>{p.kuerzel}</button>
    </header>
  );
  const aus = p.ausgeblendet ?? [];
  if (p.variante === 'werkstatt') {
    const handy = p.geraet === 'handy';
    const A: Array<[string, string, IconName, (() => void) | undefined, string]> = [
      ['Auftrag öffnen / scannen', 'Öffnen', 'open', p.onAuftragOeffnen, 'kr-aktion kr-aktion--primaer'],
      ['Mehrarbeit', 'Mehrarbeit', 'layers', p.onMehrarbeit, 'kr-aktion'], ['Fertig melden', 'Fertig', 'check', p.onFertigMelden, 'kr-aktion'],
      ['Neu erfassen', 'Erfassen', 'inbox', p.onNeuerEingang, 'kr-aktion kr-aktion--ruhig'], ['Ware raus', 'Raus', 'truck', p.onWareRaus, 'kr-aktion kr-aktion--ruhig']];
    return (<><div className="kr-streifen" /><div className="kr-tshell kr-wshell">{kopf}<main className="kr-inhalt">{p.children}</main>
      <nav className="kr-aktionsleiste" aria-label="Werkstatt-Aktionen">{A.filter(([, , , f]) => Boolean(f)).map(([t, k, ic, f, c]) => <button key={t} type="button" className={c} disabled={!interactive} onClick={f}><Icon name={ic} />{handy ? k : t}</button>)}</nav></div>{p.ebene}</>);
  }
  if (p.geraet === 'desktop') {
    const nav = (n: NavEintrag) => { const b = p.badges?.[n.id]; return (
      <button key={n.id} type="button" data-spec-id={`navigation.${n.id}`} className={cx('kr-nav', p.aktiv === n.id && 'kr-nav--aktiv')} aria-current={p.aktiv === n.id ? 'page' : undefined} disabled={!interactive} onClick={() => p.onNav(n.id)}>
        <Icon name={n.icon} /><span>{n.text}</span>{b && <span className={cx('kr-nav-badge', b.rot && 'kr-nav-badge--rot')}>{b.n}</span>}</button>); };
    return (<><div className="kr-streifen" /><div className="kr-shell">{kopf}
      <nav className="kr-seitenleiste kr-scroll" aria-label="Hauptnavigation">
        {p.onNeuerEingang && <button type="button" className="kr-nav kr-nav--schnell" disabled={!interactive} onClick={p.onNeuerEingang}><Icon name="inbox" /><span>Neu erfassen</span></button>}
        {p.onWareRaus && <button type="button" className="kr-nav kr-nav--schnell" disabled={!interactive} onClick={p.onWareRaus}><Icon name="truck" /><span>Ware raus</span></button>}
        <div className="kr-nav-trenner" />
        {NAV.filter(n => !aus.includes(n.id)).map(nav)}
        <div className="kr-nav-trenner kr-nav-unten" />
        {!aus.includes('einstellungen') && nav({ id: 'einstellungen', text: 'Einstellungen', icon: 'settings' })}
      </nav>
      <main className="kr-inhalt">{p.children}</main></div>{p.ebene}</>);
  }
  return (<><div className="kr-streifen" /><div className="kr-tshell">{kopf}<main className="kr-inhalt">{p.children}</main>
    <nav className="kr-dock" aria-label="Hauptnavigation">{DOCK.filter(d => d.id === 'mehr' || !aus.includes(d.id as Bereich)).map(d => { const b = d.id !== 'mehr' ? p.badges?.[d.id] : undefined; return (
      <button key={d.id} type="button" className={cx('kr-dock-el', p.aktiv === d.id && 'kr-dock-el--aktiv')} disabled={!interactive} onClick={() => p.onNav(d.id)}><Icon name={d.icon} />{d.text}{b?.rot && <span className="kr-dock-badge">{b.n}</span>}</button>); })}</nav></div>{p.ebene}</>);
}
export interface SeitenKopfProps { titel: string; werkzeug?: ReactNode; }
/** Genau EINE Überschrift je Seite (G5). Keine Overline, keine Unterzeile. */
export function SeitenKopf({ titel, werkzeug }: SeitenKopfProps) {
  return <div className="kr-seite-kopf"><h1 className="kr-seite-titel">{titel}</h1>{werkzeug && <div className="kr-seite-werkzeug">{werkzeug}</div>}</div>;
}
/** Runde 52: ein Größenkontext für Seite und alle darüber geöffneten Ebenen. */
export function KrApp({ geraet, children, portal = false }: { geraet: Geraet; children: ReactNode; portal?: boolean }) {
  const groesse = geraet === 'desktop' ? 'v11' : geraet === 'tablet' ? 'dicht' : 'v8';
  return <GeraetContext.Provider value={geraet}><div className="kr-app" data-geraet={geraet} data-groesse={groesse} onKeyDown={weiterMitEnter} style={portal ? { position: 'fixed', inset: 0, height: '100dvh', zIndex: 50, background: 'transparent', pointerEvents:'none' } : undefined}>{children}</div></GeraetContext.Provider>;
}

const GeraetContext = createContext<Geraet>('desktop');
export const useKrGeraet = () => useContext(GeraetContext);

/** Runde 52: dieselben tatsächlichen Hinweise auf Tablet oberhalb einklappbar. */
export function PruefRail({ children, offeneAngaben }: { children: ReactNode; offeneAngaben: number }) {
  const geraet = useKrGeraet();
  return <div className="ev-wb-rail kr-stapel">
    {geraet === 'tablet' ? <details className="r52-rail">
      <summary><Icon name="check" /><b>Prüfliste &amp; Hinweise</b><Chip text={offeneAngaben ? `${offeneAngaben} offen` : 'alles da'} ton={offeneAngaben ? 'warn' : 'ok'} /><em><Icon name="chevron-down" /></em></summary>
      <div className="r52-rail-inhalt">{children}</div>
    </details> : children}
  </div>;
}
