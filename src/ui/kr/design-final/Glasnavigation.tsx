// Erweitert die Navigation aus src/ui/kr/AppShell.tsx; das Navigationsregister und Ziele bleiben beim Aufrufer.
'use client';

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Glasknopf } from './Glasknopf';
import styles from './Glasnavigation.module.css';

const vorlagenSymbole: Readonly<Record<string, string>> = {
  tag: 'app-dein-tag', werkstatt: 'app-werkstatt', planung: 'app-planung',
  nachrichten: 'app-nachrichten', auftraege: 'app-auftraege', kunden: 'app-auftraege', lager: 'app-lager',
  geld: 'app-zahlungen', einstellungen: 'app-einstellungen', eingang: 'app-hinzufuegen', mehr: 'hauptmenue-weitere',
};

export function GlasNavigationsSymbol({ bereich, ersatz }: { bereich: string; ersatz?: ReactNode }) {
  const datei = vorlagenSymbole[bereich];
  if (!datei) return ersatz ?? null;
  const quelle = `url('/design/icons/${datei}.svg')`;
  return <span aria-hidden="true" className={styles.vorlagenSymbol} style={{ maskImage: quelle, WebkitMaskImage: quelle }} />;
}

export type Glaseintrag = {
  id: string;
  text: string;
  icon: ReactNode;
  zaehler?: ReactNode;
  zaehlerBeschreibung?: string;
  gruppe?: 'haupt' | 'unten';
  dockSpalte?: 1 | 2 | 4;
  specId?: string;
  aufrufen: () => void;
};

type Symbolaktion = { text: string; icon: ReactNode; ausloesen: () => void };

type Leiste = {
  art: 'leiste';
  kompakt?: boolean;
  offen: boolean;
  oeffnen: Symbolaktion;
  schliessen: Symbolaktion;
  marke: { text: string; icon: ReactNode };
  werkzeuge?: readonly Symbolaktion[];
  werkzeugeLabel?: string;
};

type Dock = {
  art: 'dock';
  kompakt?: boolean;
  erfassung?: Symbolaktion;
  weitere?: Pick<Symbolaktion, 'icon' | 'text'> & {
    zielbezeichnung?: string;
    eintraege: readonly Glaseintrag[];
    aufrufen?: (oeffner: HTMLButtonElement) => void;
  };
};

export type GlasnavigationProps = (Leiste | Dock) & {
  label: string;
  aktiv: string;
  eintraege: readonly Glaseintrag[];
  deaktiviert?: boolean;
  klasse?: string;
};

function GlasnavigationEintrag({ eintrag, aktiv, aufrufen, deaktiviert, panel = false }: {
  eintrag: Glaseintrag; aktiv: boolean; aufrufen?: () => void; deaktiviert?: boolean; panel?: boolean;
}) {
  const beschreibungId = useId();
  return (
    <button type="button" className={styles.eintrag} aria-label={eintrag.text} title={eintrag.text}
      aria-describedby={eintrag.zaehlerBeschreibung ? beschreibungId : undefined}
      data-spec-id={eintrag.specId} data-dock-spalte={eintrag.dockSpalte} disabled={deaktiviert}
      data-nav-active={!panel && aktiv || undefined} aria-current={aktiv ? 'page' : undefined}
      data-nav-unten={eintrag.gruppe === 'unten' || undefined} onClick={aufrufen ?? eintrag.aufrufen}>
      <span className={styles.icon} aria-hidden="true">{eintrag.icon}</span>
      <span className={styles.text}>{eintrag.text}</span>
      {eintrag.zaehler != null && <span className={styles.zaehler}>{eintrag.zaehler}</span>}
      {eintrag.zaehlerBeschreibung && <span id={beschreibungId} hidden>{eintrag.zaehlerBeschreibung}</span>}
    </button>
  );
}

export function Glasnavigation(p: GlasnavigationProps) {
  const navigation = useRef<HTMLElement>(null);
  const schalterRef = useRef<HTMLButtonElement>(null);
  const gruppe = useRef<HTMLDivElement>(null);
  const flaeche = useRef<HTMLSpanElement>(null);
  const auswahlbewegung = useRef<Animation | null>(null);
  const letzteAnordnung = useRef(p.art);
  const mehr = useRef<HTMLDivElement>(null);
  const mehrSchalter = useRef<HTMLButtonElement>(null);
  const leisteId = useId();
  const mehrId = useId();
  const mehrBeschreibungId = useId();
  const eintraege = p.eintraege;
  const leiste = p.art === 'leiste';
  const offen = leiste && p.offen;
  const schliessen = leiste ? p.schliessen.ausloesen : undefined;
  const aktiv = p.aktiv;
  const weiteresAktiv = p.art === 'dock' && Boolean(p.weitere?.eintraege.some((eintrag) => eintrag.id === aktiv));

  // Eine Fläche, deren Lauf bei Zielwechsel an ihrer aktuell sichtbaren Position einsetzt.
  useLayoutEffect(() => {
    const rahmen = gruppe.current;
    const glas = flaeche.current;
    if (!rahmen || !glas) return;
    const reduzierteBewegung = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const gleicheAnordnung = letzteAnordnung.current === p.art;
    letzteAnordnung.current = p.art;
    const messen = (gleiten: boolean) => {
      const ziel = rahmen.querySelector<HTMLElement>('[data-nav-active="true"]');
      const sichtbar = Boolean(ziel?.offsetWidth && ziel.offsetHeight);
      const warSichtbar = glas.hasAttribute('data-sichtbar');
      if (glas.hasAttribute('data-sichtbar') !== sichtbar) glas.toggleAttribute('data-sichtbar', sichtbar);
      if (!ziel || !sichtbar) {
        auswahlbewegung.current?.cancel();
        return;
      }
      // offset-Maße ignorieren das vorübergehende Druckfeedback am ausgewählten Knopf.
      const x = `${ziel.offsetLeft}px`;
      const y = `${ziel.offsetTop}px`;
      const bewegt = glas.style.getPropertyValue('--gb-marke-x') !== x || glas.style.getPropertyValue('--gb-marke-y') !== y;
      const darfGleiten = bewegt && warSichtbar && gleiten && !reduzierteBewegung?.matches && typeof glas.animate === 'function';
      let bisher = '';
      if (darfGleiten) {
        const sichtbox = glas.getBoundingClientRect();
        const bezug = rahmen.getBoundingClientRect();
        const links = sichtbox.left - bezug.left + rahmen.scrollLeft - rahmen.clientLeft;
        const oben = sichtbox.top - bezug.top + rahmen.scrollTop - rahmen.clientTop;
        bisher = `translate(${links}px, ${oben}px)`;
      }
      if (bewegt) auswahlbewegung.current?.cancel();
      const groessen = {
        '--gb-marke-x': x,
        '--gb-marke-y': y,
        '--gb-marke-b': `${ziel.offsetWidth}px`,
        '--gb-marke-h': `${ziel.offsetHeight}px`,
      };
      for (const [name, laenge] of Object.entries(groessen)) {
        if (glas.style.getPropertyValue(name) !== laenge) glas.style.setProperty(name, laenge);
      }
      if (!darfGleiten) return;
      const tokens = getComputedStyle(glas);
      const zeit = tokens.getPropertyValue('--gb-bewegung-markierung').trim();
      const dauer = Number.parseFloat(zeit) * (zeit.endsWith('ms') ? 1 : 1000);
      const easing = tokens.getPropertyValue('--gb-bewegung-kurve').trim();
      if (dauer > 0 && easing) {
        auswahlbewegung.current = glas.animate([{ transform: bisher }, { transform: `translate(${x}, ${y})` }],
          { duration: dauer, easing });
      }
    };
    const bewegungAnpassen = () => { if (reduzierteBewegung?.matches) auswahlbewegung.current?.cancel(); };
    if (!gleicheAnordnung) auswahlbewegung.current?.cancel();
    messen(gleicheAnordnung);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => messen(auswahlbewegung.current?.playState === 'running'));
    observer?.observe(rahmen);
    for (const kind of rahmen.children) {
      if (kind instanceof HTMLButtonElement) observer?.observe(kind);
    }
    reduzierteBewegung?.addEventListener('change', bewegungAnpassen);
    return () => {
      observer?.disconnect();
      reduzierteBewegung?.removeEventListener('change', bewegungAnpassen);
    };
  }, [aktiv, eintraege, p.art, weiteresAktiv]);

  useEffect(() => {
    if (!offen || !schliessen) return;
    const hauptnavigation = navigation.current;
    if (!hauptnavigation) return;
    const aussen = (event: MouseEvent) => {
      if (!event.composedPath().includes(hauptnavigation)) schliessen();
    };
    const tastatur = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && event.composedPath().includes(hauptnavigation)) {
        event.preventDefault();
        schliessen();
        schalterRef.current?.focus({ preventScroll: true });
      }
    };
    hauptnavigation.ownerDocument.addEventListener('click', aussen, true);
    hauptnavigation.addEventListener('keydown', tastatur);
    return () => {
      hauptnavigation.ownerDocument.removeEventListener('click', aussen, true);
      hauptnavigation.removeEventListener('keydown', tastatur);
    };
  }, [offen, schliessen]);

  const markierung = <span className={styles.markierung} aria-hidden="true" ref={flaeche} />;
  const klasse = [styles.navigation, p.klasse].filter(Boolean).join(' ');

  if (p.art === 'leiste') {
    const schalter = p.offen ? p.schliessen : p.oeffnen;
    const hatWerkzeuge = Boolean(p.werkzeuge?.length);
    return (
      <nav ref={navigation} className={klasse} data-layout="leiste" data-offen={offen || undefined} data-kompakt={p.kompakt || undefined}
        aria-label={p.label} data-werkzeuge={hatWerkzeuge || undefined}>
        <div className={styles.kopf}>
          <button ref={schalterRef} type="button" aria-label={schalter.text} aria-expanded={offen}
            aria-controls={leisteId} className={styles.marke} onClick={schalter.ausloesen} disabled={p.deaktiviert}>
            <span className={styles.logo} aria-hidden="true">{p.marke.icon}</span>
            <span className={styles.text} aria-hidden="true">{p.marke.text}</span>
            <span className={styles.schalter} aria-hidden="true">{schalter.icon}</span>
          </button>
        </div>
        <div id={leisteId} className={styles.verbund} ref={gruppe}>
          {markierung}
          {eintraege.map((eintrag) => <GlasnavigationEintrag key={eintrag.id} eintrag={eintrag} aktiv={aktiv === eintrag.id} deaktiviert={p.deaktiviert} />)}
        </div>
        {hatWerkzeuge && <div role="group" aria-label={p.werkzeugeLabel} className={styles.werkzeuge} hidden={!offen}>
          {p.werkzeuge?.map((werkzeug) => <Glasknopf key={werkzeug.text} knopfform="quadrat" bezeichnung={werkzeug.text}
            icon={werkzeug.icon} onClick={werkzeug.ausloesen} disabled={p.deaktiviert} />)}
        </div>}
      </nav>
    );
  }

  return (
    <nav className={klasse} data-layout="dock" data-kompakt={p.kompakt || undefined} aria-label={p.label}>
      <div className={styles.verbund} ref={gruppe}>
        {markierung}
        {(p.kompakt ? eintraege.filter(eintrag => eintrag.dockSpalte !== 4) : eintraege)
          .map((eintrag) => <GlasnavigationEintrag key={eintrag.id} eintrag={eintrag} aktiv={aktiv === eintrag.id} deaktiviert={p.deaktiviert} />)}
        {p.erfassung && <Glasknopf knopfform="dock" className={styles.erfassung} ton="erfassung" text={p.erfassung.text}
          data-spec-id="navigation.plus" icon={p.erfassung.icon} onClick={p.erfassung.ausloesen} disabled={p.deaktiviert} />}
        {p.kompakt && eintraege.filter(eintrag => eintrag.dockSpalte === 4)
          .map((eintrag) => <GlasnavigationEintrag key={eintrag.id} eintrag={eintrag} aktiv={aktiv === eintrag.id} deaktiviert={p.deaktiviert} />)}
        {p.weitere && <button ref={mehrSchalter} type="button" className={styles.eintrag} popoverTarget={p.weitere.aufrufen ? undefined : mehrId}
          data-dock-spalte="5" onClick={p.weitere.aufrufen && (event => p.weitere?.aufrufen?.(event.currentTarget))}
          disabled={p.deaktiviert} aria-haspopup={p.weitere.aufrufen ? 'dialog' : undefined}
          data-nav-active={weiteresAktiv || undefined} aria-describedby={weiteresAktiv && p.weitere.zielbezeichnung ? mehrBeschreibungId : undefined}>
          <span className={styles.icon} aria-hidden="true">{p.weitere.icon}</span>
          <span className={styles.text}>{p.weitere.text}</span>
          {weiteresAktiv && p.weitere.zielbezeichnung && <span id={mehrBeschreibungId} hidden>{p.weitere.zielbezeichnung}</span>}
        </button>}
      </div>
      {p.weitere && !p.weitere.aufrufen && <div id={mehrId} popover="auto" ref={mehr} role="group" aria-label={p.weitere.text} className={styles.mehr}>
        {p.weitere.eintraege.map((eintrag) => <GlasnavigationEintrag key={eintrag.id} eintrag={eintrag} panel aktiv={aktiv === eintrag.id}
          aufrufen={() => {
            mehr.current?.hidePopover();
            mehrSchalter.current?.focus({ preventScroll: true });
            eintrag.aufrufen();
          }} />)}
      </div>}
    </nav>
  );
}
