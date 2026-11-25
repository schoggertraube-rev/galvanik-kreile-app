'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { weiterMitEnter } from './tastatur';
import { Icon, type IconName } from './Icon';
import { Chip } from './Chip';
import { useHydrated } from '@/hooks/useHydrated';
import type { Geraet } from './typen';
import { cx } from './typen';
import styles from './AppShell.module.css';
import {NAVIGATION,type Bereich} from '../navigation/register';
import { Glasnavigation, type Glaseintrag } from './design-final/Glasnavigation';
import { KREILE_KOPF_KUERZEL } from '@/ui/allgemeinCopy';
export type {Bereich} from '../navigation/register';
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
  onPlanung?: () => void;
  navigationsleiste?: boolean;
  /** nur variante=werkstatt */ onAuftragOeffnen?: () => void; onMehrarbeit?: () => void; onFertigMelden?: () => void;
  ebene?: ReactNode; zustand?:ReactNode;children: ReactNode;
}
/** Navigation nach Gerät, nicht nach Rolle. Aktionsleiste NUR variante=werkstatt – nie auf Büro-Desktop (G3/G4). Kalender-Menüpunkt erst nach M365-Abnahme. */
export function AppShell(p: AppShellProps) {
  const interactive = useHydrated();
  const [menuOffen,setMenuOffen] = useState(false);
  const handy = p.geraet === 'handy';
  const leiste = p.navigationsleiste ?? p.geraet === 'desktop';
  const klein = handy && p.variante === 'buero';
  const kopf = (
    <header className={cx('kr-kopf', klein && styles.handyKopf)}>
      <button type="button" className="kr-marke" aria-label="Startseite" disabled={!interactive} onClick={p.onStart}><span className="kr-logo">{KREILE_KOPF_KUERZEL}</span><span className="kr-marke-name">KREILE</span></button>
      {p.suche}
      {!klein && p.neuigkeiten}
      {p.datum && p.geraet === 'desktop' && <span className="kr-datum">{p.datum}</span>}
      {!klein && p.plus}
      {!klein && <button type="button" className="kr-avatar" aria-label="Konto" disabled={!interactive} onClick={p.onKonto}>{p.kuerzel}</button>}
    </header>
  );
  const aus = p.ausgeblendet ?? [];
  if (p.variante === 'werkstatt') {
    const A: Array<[string, string, IconName, (() => void) | undefined, string]> = [
      ['Auftrag öffnen / scannen', 'Öffnen', 'open', p.onAuftragOeffnen, 'kr-aktion kr-aktion--primaer'],
      ['Mehrarbeit', 'Mehrarbeit', 'layers', p.onMehrarbeit, 'kr-aktion'], ['Fertig melden', 'Fertig', 'check', p.onFertigMelden, 'kr-aktion'],
      ['Neu erfassen', 'Erfassen', 'inbox', p.onNeuerEingang, 'kr-aktion kr-aktion--ruhig'], ['Ware raus', 'Raus', 'truck', p.onWareRaus, 'kr-aktion kr-aktion--ruhig']];
    return (<><div className="kr-streifen" /><div className="kr-tshell kr-wshell">{kopf}{p.zustand}<main className="kr-inhalt">{p.children}</main>
      <nav className="kr-aktionsleiste" aria-label="Werkstatt-Aktionen">{A.filter(([, , , f]) => Boolean(f)).map(([t, k, ic, f, c]) => <button key={t} type="button" className={c} disabled={!interactive} onClick={f}><Icon name={ic} />{handy ? k : t}</button>)}</nav></div>{p.ebene}</>);
  }
  const sichtbareZiele: Glaseintrag[] = NAVIGATION.filter(entry => !aus.includes(entry.id)).map(entry => ({
    id: entry.id, text: entry.text, icon: <Icon name={entry.icon} />,
    specId: `navigation.${entry.id}`, gruppe: entry.platz === 'unten' ? 'unten' : 'haupt',
    zaehler: p.badges?.[entry.id]?.n, aufrufen: () => p.onNav(entry.id),
  }));
  const dockEintraege = sichtbareZiele.flatMap<Glaseintrag>(entry => {
    if (entry.id === 'tag') return [{...entry, text: 'Dein Tag', dockSpalte: 1}];
    if (entry.id === 'werkstatt') return [{...entry, dockSpalte: 2}];
    return [];
  });
  if (p.onPlanung) dockEintraege.push({ id: 'planung', text: 'Planung', icon: <Icon name="list" />,
    dockSpalte: 4, specId: 'navigation.planung', aufrufen: p.onPlanung });
  const weitereZiele = sichtbareZiele.filter(entry => !dockEintraege.some(dock => dock.id === entry.id));
  const erfassung = p.onNeuerEingang && {text: 'Eingang', icon: <Icon name="plus" />, ausloesen: p.onNeuerEingang};
  const werkzeuge = [
    ...(p.onNeuerEingang ? [{text: 'Neu erfassen', icon: <Icon name="inbox" />, ausloesen: p.onNeuerEingang}] : []),
    ...(p.onWareRaus ? [{text: 'Ware raus', icon: <Icon name="truck" />, ausloesen: p.onWareRaus}] : []),
  ];
  const nav = leiste
    ? <Glasnavigation art="leiste" klasse={styles.leiste} kompakt={p.geraet === 'tablet'} label="Hauptnavigation"
        aktiv={p.aktiv} eintraege={sichtbareZiele} deaktiviert={!interactive} offen={menuOffen}
        marke={{text: 'KREILE', icon: <span className="kr-logo">{KREILE_KOPF_KUERZEL}</span>}}
        werkzeuge={werkzeuge} werkzeugeLabel="Werkzeuge"
        oeffnen={{text: 'Menü öffnen', icon: <Icon name="grid" />, ausloesen: () => setMenuOffen(true)}}
        schliessen={{text: 'Menü schließen', icon: <Icon name="x" />, ausloesen: () => setMenuOffen(false)}} />
    : <Glasnavigation art="dock" kompakt={handy} label="Hauptnavigation" aktiv={p.aktiv}
        eintraege={dockEintraege} deaktiviert={!interactive} erfassung={erfassung}
        weitere={{text: 'Mehr', icon: <Icon name="grid" />, eintraege: weitereZiele, aufrufen: () => p.onNav('mehr')}} />;
  return <><div className="kr-streifen" /><div className={cx('kr-tshell', styles.rahmen, leiste ? styles.mitLeiste : styles.mitDock)}>
    {kopf}{p.zustand}<main className="kr-inhalt">{p.children}</main>{nav}
  </div>{p.ebene}</>;
}
export interface SeitenKopfProps { titel: string; werkzeug?: ReactNode; }
/** Genau EINE Überschrift je Seite (G5). Keine Overline, keine Unterzeile. */
export function SeitenKopf({ titel, werkzeug }: SeitenKopfProps) {
  return <div className="kr-seite-kopf"><h1 className="kr-seite-titel">{titel}</h1>{werkzeug && <div className="kr-seite-werkzeug">{werkzeug}</div>}</div>;
}
/** Runde 52: ein Größenkontext für Seite und alle darüber geöffneten Ebenen. */
export function KrApp({ geraet, children, portal = false, vorfinal }: { geraet: Geraet; children: ReactNode; portal?: boolean; vorfinal?:boolean }) {
  const parent=useContext(GeraetContext);
  const groesse = geraet === 'desktop' ? 'v11' : geraet === 'tablet' ? 'dicht' : 'v8';
  return <GeraetContext.Provider value={{geraet,vorfinal:vorfinal??parent.vorfinal}}><div className="kr-app" data-geraet={geraet} data-groesse={groesse} onKeyDown={weiterMitEnter} style={portal ? { position: 'fixed', inset: 0, height: '100dvh', zIndex: 50, background: 'transparent', pointerEvents:'none' } : undefined}>{children}</div></GeraetContext.Provider>;
}

const GeraetContext = createContext<{geraet:Geraet;vorfinal:boolean}>({geraet:'desktop',vorfinal:false});
export const useKrGeraet = () => useContext(GeraetContext).geraet;
/** Existing presentation context only; this Boolean never grants a command. */
export const useKrVorfinalStyle = () => useContext(GeraetContext).vorfinal;

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
