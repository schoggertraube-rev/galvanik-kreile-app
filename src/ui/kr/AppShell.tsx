'use client';
import Image from 'next/image';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { weiterMitEnter } from './tastatur';
import { Icon, type IconName } from './Icon';
import { Chip } from './Chip';
import { Glasknopf, type GlasknopfProps } from './design-final/Glasknopf';
import { useHydrated } from '@/hooks/useHydrated';
import type { Geraet } from './typen';
import { cx } from './typen';
import styles from './AppShell.module.css';
import {sichtbareNavigation,type Bereich} from '../navigation/register';
import { Glasnavigation, GlasNavigationsSymbol, type Glaseintrag } from './design-final/Glasnavigation';
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
  onNav: (b: Bereich | 'mehr', oeffner?: HTMLButtonElement) => void;
  onStart: () => void; onKonto: (oeffner: HTMLButtonElement) => void;
  onNeuerEingang?: () => void; onWareRaus?: () => void;
  onPlanung?: () => void;
  navigationsleiste?: boolean;
  /** nur variante=werkstatt */ onAuftragOeffnen?: () => void; onMehrarbeit?: () => void; onFertigMelden?: () => void;
  ebene?: ReactNode | ((werkstattWerkzeuge: ReactNode) => ReactNode); zustand?:ReactNode;children: ReactNode;
}
/** Navigation nach Gerät, nicht nach Rolle. Aktionsleiste NUR variante=werkstatt – nie auf Büro-Desktop (G3/G4). Kalender-Menüpunkt erst nach M365-Abnahme. */
export function AppShell(p: AppShellProps) {
  const interactive = useHydrated();
  const [menuOffen,setMenuOffen] = useState(false);
  const handy = p.geraet === 'handy';
  const leiste = p.navigationsleiste ?? p.geraet === 'desktop';
  const klein = handy;
  const werkstatt = p.variante === 'werkstatt';
  const kopf = (
    <header className={cx('kr-kopf', klein && styles.handyKopf)}>
      <button type="button" className="kr-marke" aria-label="Startseite" disabled={!interactive} onClick={p.onStart}><span className="kr-logo">{KREILE_KOPF_KUERZEL}</span><span className="kr-marke-name">KREILE</span></button>
      {p.suche}
      {!klein && p.neuigkeiten}
      {p.datum && p.geraet === 'desktop' && <span className="kr-datum">{p.datum}</span>}
      {!klein && p.plus}
      {!klein && <button type="button" className="kr-avatar" aria-label="Konto" disabled={!interactive} onClick={event => p.onKonto(event.currentTarget)}>{p.kuerzel}</button>}
    </header>
  );
  const aus = p.ausgeblendet ?? [];
  const werkstattAktionen: readonly {
    text: string; icon: IconName; ton: NonNullable<GlasknopfProps['ton']>; ausloesen?: () => void; imDock?: true
  }[] = werkstatt ? [
    {text: 'Auftrag öffnen / scannen', icon: 'open', ton: 'haupt', ausloesen: p.onAuftragOeffnen},
    {text: 'Mehrarbeit', icon: 'layers', ton: 'sekundaer', ausloesen: p.onMehrarbeit},
    {text: 'Fertig melden', icon: 'check', ton: 'sekundaer', ausloesen: p.onFertigMelden},
    {text: 'Neu erfassen', icon: 'inbox', ton: 'leise', ausloesen: p.onNeuerEingang, imDock: true},
    {text: 'Ware raus', icon: 'truck', ton: 'leise', ausloesen: p.onWareRaus},
  ] : [];
  const werkstattKnopf = (aktion: typeof werkstattAktionen[number]) => <Glasknopf key={aktion.text}
    text={aktion.text} icon={<Icon name={aktion.icon} />} ton={aktion.ton} disabled={!interactive} onClick={aktion.ausloesen} />;
  const werkstattLeiste = werkstattAktionen.filter(aktion => aktion.ausloesen && (!handy || aktion.ton === 'haupt'));
  const werkstattWeitere = handy ? werkstattAktionen.filter(aktion => aktion.ausloesen && aktion.ton !== 'haupt' && !aktion.imDock) : [];
  const ebene = typeof p.ebene === 'function' ? p.ebene(werkstattWeitere.length > 0
    ? <div className={styles.werkstattWerkzeuge}>{werkstattWeitere.map(werkstattKnopf)}</div> : null)
    : p.ebene;
  const navigation = sichtbareNavigation(aus);
  const aktiv = p.aktiv === 'kunden' && navigation.some(entry => entry.id === 'auftraege') ? 'auftraege' : p.aktiv;
  const sichtbareZiele: Glaseintrag[] = navigation.map(entry => ({
    id: entry.id,
    text: leiste && (entry.id === 'auftraege' || entry.id === 'kunden') ? 'Aufträge und Kunden' : entry.text,
    icon: <GlasNavigationsSymbol bereich={entry.id} ersatz={<Icon name={entry.icon}/>} />,
    specId: `navigation.${entry.id}`, gruppe: entry.platz === 'unten' ? 'unten' : 'haupt',
    zaehler: p.badges?.[entry.id]?.n, aufrufen: () => p.onNav(entry.id),
  }));
  const planung: Glaseintrag | null = p.onPlanung
    ? {id: 'planung', text: 'Planung', icon: <GlasNavigationsSymbol bereich="planung" />, dockSpalte: 4,
      specId: 'navigation.planung', aufrufen: p.onPlanung}
    : null;
  if (planung) {
    const werkstattIndex = sichtbareZiele.findIndex(eintrag => eintrag.id === 'werkstatt');
    sichtbareZiele.splice(werkstattIndex + 1, 0, planung);
  }
  const dockEintraege = sichtbareZiele.flatMap<Glaseintrag>(entry => {
    if (entry.id === 'tag') return [{...entry, dockSpalte: 1}];
    if (entry.id === 'werkstatt') return [{...entry, dockSpalte: 2}];
    if (entry.id === 'planung') return [entry];
    return [];
  });
  const weitereZiele = sichtbareZiele.filter(entry => !dockEintraege.some(dock => dock.id === entry.id));
  const erfassung = p.onNeuerEingang && {text: 'Eingang', icon: <GlasNavigationsSymbol bereich="eingang" />, ausloesen: p.onNeuerEingang};
  const werkzeuge = werkstatt ? [] : [
    ...(p.onNeuerEingang ? [{text: 'Neu erfassen', icon: <Icon name="inbox" />, ausloesen: p.onNeuerEingang}] : []),
    ...(p.onWareRaus ? [{text: 'Ware raus', icon: <Icon name="truck" />, ausloesen: p.onWareRaus}] : []),
  ];
  const nav = leiste
    ? <Glasnavigation art="leiste" klasse={styles.leiste} kompakt={p.geraet === 'tablet'} label="Hauptnavigation"
        aktiv={aktiv} eintraege={sichtbareZiele} deaktiviert={!interactive} offen={menuOffen}
        marke={{text: 'Galvanik Kreile', icon: <Image src="/design/bild-cb9d2615.png" alt="" width={36} height={36} unoptimized />}}
        werkzeuge={werkzeuge} werkzeugeLabel="Werkzeuge"
        oeffnen={{text: 'Menü öffnen', icon: <Icon name="grid" />, ausloesen: () => setMenuOffen(true)}}
        schliessen={{text: 'Menü schließen', icon: <Icon name="x" />, ausloesen: () => setMenuOffen(false)}} />
    : <Glasnavigation art="dock" kompakt={handy} label="Hauptnavigation" aktiv={aktiv}
        eintraege={dockEintraege} deaktiviert={!interactive} erfassung={erfassung}
        weitere={{text: 'Mehr', icon: <GlasNavigationsSymbol bereich="mehr" />, eintraege: weitereZiele, aufrufen: oeffner => p.onNav('mehr', oeffner)}} />;
  return <><div className="kr-streifen" /><div className={cx('kr-tshell', styles.rahmen, leiste ? styles.mitLeiste : styles.mitDock)}>
    {kopf}{p.zustand}<main className="kr-inhalt">{p.children}</main>
    {werkstattLeiste.length > 0 ? <>
      <nav className={styles.werkstattAktionen} aria-label="Werkstatt-Aktionen">
        {werkstattLeiste.map(werkstattKnopf)}
      </nav>
      {nav}
    </> : nav}
  </div>{ebene}</>;
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
