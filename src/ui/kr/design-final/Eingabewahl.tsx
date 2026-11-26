'use client';

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type MouseEvent, type PointerEvent, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { berlinCalendarDay } from '@/lib/domain/workingDays';
import { FELDWAHL_COPY as copy } from '@/ui/allgemeinCopy';
import { Datumswahl, type Kalenderrichtung } from './Datumswahl';
import { Uhrzeitwahl } from './Uhrzeitwahl';
import { Zahlenwahl } from './Zahlenwahl';

type Auswahlart = 'date' | 'time' | 'number';
type Auswahl = {
  art: Auswahlart;
  feld: HTMLInputElement;
  titel: string;
  wert: string;
  offen: boolean;
};
type Dialog = {
  offen: boolean;
  titel: string;
  oeffner: HTMLInputElement;
  schliessenText: string;
  onSchliessen: () => void;
  onGeschlossen: () => void;
};

const wahlSchluessel = 'kreileFormularauswahl';
const nullen = (zahl: number) => String(zahl).padStart(2, '0');
const kalt = (wert: string) => new Date(wert + 'T12:00:00Z');
const tagId = (tag: Date) => tag.toISOString().slice(0, 10);
const wochentag = (tag: Date) => (tag.getUTCDay() + 6) % 7;
const tageFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const monatFormat = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const wochentage = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
  .map(lang => ({ lang, kurz: lang.slice(0, 2) }));
const istTag = (wert: string) => /^\d{4}-\d{2}-\d{2}$/.test(wert) && Number.isFinite(kalt(wert).getTime()) && tagId(kalt(wert)) === wert;

function erprobe(feld: HTMLInputElement) {
  const kopie = feld.cloneNode() as HTMLInputElement;
  return (wert: string) => {
    kopie.value = wert;
    return (wert === '' || kopie.value !== '') && kopie.validity.valid;
  };
}

function verschiebeTag(wert: string, anzahl: number) {
  const tag = kalt(wert);
  tag.setUTCDate(tag.getUTCDate() + anzahl);
  return tagId(tag);
}

function verschiebeMonat(wert: string, anzahl: number) {
  const tag = kalt(wert.slice(0, 7) + '-01');
  tag.setUTCMonth(tag.getUTCMonth() + anzahl);
  return tagId(tag);
}

function Datum({ auswahl, dialog, onWert }: { auswahl: Auswahl; dialog: Dialog; onWert: (wert: string) => void }) {
  const heute = berlinCalendarDay();
  const gueltig = erprobe(auswahl.feld);
  const min = istTag(auswahl.feld.min) ? auswahl.feld.min : '';
  const max = istTag(auswahl.feld.max) ? auswahl.feld.max : '';
  const [fokus, setFokus] = useState(() => {
    if (istTag(auswahl.wert)) return auswahl.wert;
    if (min && heute < min) return min;
    return max && heute > max ? max : heute;
  });
  const [monat, setMonat] = useState(() => verschiebeMonat(fokus, 0));
  const erster = kalt(monat);
  const letzter = verschiebeTag(verschiebeMonat(monat, 1), -1);
  const tage = Array.from({ length: Number(letzter.slice(-2)) }, (_, index) => {
    const id = verschiebeTag(monat, index);
    return { id, text: String(index + 1), vorlesen: tageFormat.format(kalt(id)), heute: id === heute,
      gewaehlt: id === auswahl.wert, deaktiviert: !gueltig(id) };
  });
  const benachbarterMonat = (richtung: number) => {
    const ziel = verschiebeMonat(monat, richtung);
    const ende = verschiebeTag(verschiebeMonat(ziel, 1), -1);
    return { deaktiviert: Boolean((min && ende < min) || (max && ziel > max)),
      onWahl: () => {
        setMonat(ziel);
        setFokus(auswahl.wert.startsWith(ziel.slice(0, 7)) ? auswahl.wert : min && min > ziel ? min : ziel);
      } };
  };
  const fokusSchritt = (id: string, richtung: Kalenderrichtung) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -wochentag(kalt(id)), End: 6 - wochentag(kalt(id)) };
    const ziel = verschiebeTag(id, delta[richtung]);
    if (!gueltig(ziel)) return;
    setMonat(verschiebeMonat(ziel, 0));
    setFokus(ziel);
  };
  return <Datumswahl {...dialog} monat={monatFormat.format(erster)}
    zurueck={{ text: copy.vorherigerMonat, symbol: '‹', ...benachbarterMonat(-1) }}
    vor={{ text: copy.naechsterMonat, symbol: '›', ...benachbarterMonat(1) }}
    wochentage={wochentage} tage={[...Array.from({ length: wochentag(erster) }, () => null), ...tage]}
    fokusTag={fokus} onFokusSchritt={fokusSchritt} onTag={onWert} />;
}

const minuten = Array.from({ length: 60 }, (_, wert) => ({ wert, anzeige: nullen(wert), vorlesen: nullen(wert) }));
const stunden = minuten.slice(0, 24);

function Zeit({ auswahl, dialog, onWert }: { auswahl: Auswahl; dialog: Dialog; onWert: (wert: string) => void }) {
  const [stunde, setStunde] = useState(auswahl.wert ? Number(auswahl.wert.slice(0, 2)) : -1);
  const [minute, setMinute] = useState(auswahl.wert ? Number(auswahl.wert.slice(3, 5)) : -1);
  const [ausserhalb, setAusserhalb] = useState(false);
  const gueltig = erprobe(auswahl.feld);
  const zeit = (min: number) => stunde >= 0 && min >= 0 ? nullen(stunde) + ':' + nullen(min) : '';
  const wert = zeit(minute);
  function uebernehmen(min: number) {
    const kandidat = zeit(min);
    if (kandidat && gueltig(kandidat)) onWert(kandidat);
    else if (kandidat) setAusserhalb(true);
  }
  return <Uhrzeitwahl {...dialog}
    stunden={{ name: copy.stunden, kleinerText: copy.kleiner(copy.stunden), groesserText: copy.groesser(copy.stunden),
      optionen: stunden, wert: stunde, onWahl: wert => { setStunde(wert); setAusserhalb(false); } }}
    minuten={{ name: copy.minuten, kleinerText: copy.kleiner(copy.minuten), groesserText: copy.groesser(copy.minuten),
      optionen: minuten, wert: minute, onWahl: wert => { setMinute(wert); setAusserhalb(false); } }}
    minusSymbol="−" plusSymbol="+" uebernehmenText={wert ? copy.zeitWaehlen(wert) : copy.uebernehmen}
    uebernehmenVorlesen={wert ? copy.zeitEinsetzen(wert) : undefined}
    uebernehmenGesperrt={!wert || !gueltig(wert)} fehler={ausserhalb ? copy.ausserhalb : undefined}
    onUebernehmen={() => uebernehmen(minute)}
    onMinuteAntippen={wert => { setMinute(wert); uebernehmen(wert); }} />;
}

function Zahl({ auswahl, dialog, onWert }: { auswahl: Auswahl; dialog: Dialog; onWert: (wert: string) => void }) {
  const feld = auswahl.feld;
  const [entwurf, setEntwurf] = useState(auswahl.wert.replace('.', ','));
  const [tastatur, setTastatur] = useState(false);
  const wert = entwurf.replace(',', '.');
  const gueltig = erprobe(feld)(wert);
  const komma = feld.step === 'any' || [feld.step, feld.min, feld.max, auswahl.wert].some(wert => Number(wert) % 1 !== 0);
  function schritt(anzahl: number) {
    const kopie = feld.cloneNode() as HTMLInputElement;
    kopie.value = wert;
    kopie.stepUp(anzahl);
    setEntwurf(kopie.value.replace('.', ','));
  }
  return <Zahlenwahl {...dialog} wert={entwurf} ungueltig={!gueltig} hinweis={gueltig ? undefined : copy.ausserhalb}
    ziffernGruppe={copy.ziffern} komma={{ erlaubt: komma && !entwurf.includes(',') && !entwurf.includes('.'), text: copy.komma, zeichen: ',' }}
    loeschen={{ text: copy.loeschen, symbol: '⌫' }} schliessenSymbol="×"
    minus={{ text: copy.minus, symbol: '−', deaktiviert: feld.step === 'any', onAktion: () => schritt(-1) }}
    plus={{ text: copy.plus, symbol: '+', deaktiviert: feld.step === 'any', onAktion: () => schritt(1) }}
    tastatur={{ text: copy.tastatur, onAktion: () => setTastatur(wert => !wert) }}
    leeren={{ text: copy.leeren, onAktion: () => setEntwurf('') }}
    uebernehmen={{ text: copy.uebernehmen, deaktiviert: !gueltig, onAktion: () => onWert(wert) }}
    nativeEingabe={tastatur ? { text: copy.wert, wert: entwurf, onWert: setEntwurf } : undefined}
    onTaste={taste => setEntwurf(wert => taste === 'loeschen' ? wert.slice(0, -1)
      : wert + (taste === 'komma' ? ',' : taste))} />;
}

function passendeArt(feld: HTMLInputElement): Auswahlart | null {
  if (feld.disabled || feld.readOnly || feld.hasAttribute('data-gk-native-only')) return null;
  if (feld.type === 'time') {
    const hatSekunden = feld.value.length > 5 && !/^\d\d:\d\d:00(?:\.0+)?$/.test(feld.value);
    const sekundenSchritt = feld.step !== '' && feld.step !== 'any' && Number(feld.step) < 60;
    return hatSekunden || sekundenSchritt ? null : 'time';
  }
  if (feld.type === 'date') return feld.value === '' || istTag(feld.value) ? 'date' : null;
  return feld.type === 'number' ? 'number' : null;
}

/** Öffnet eine lokale Wählerebene auf dem vorhandenen Eingabefeld. */
function useEingabewahl(onWert: (feld: HTMLInputElement, wert: string) => void, label?: string) {
  const id = useId();
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  const gedrueckt = useRef<{ feld: HTMLInputElement; id: number; x: number; y: number } | null>(null);
  const aktiv = useRef(false);
  const amSchliessen = useRef(false);
  const letzterTouch = useRef<HTMLElement | null>(null);
  const laeuft = auswahl !== null;

  useEffect(() => {
    if (!laeuft) return;
    function zurueck(event: PopStateEvent) {
      if (event.state?.[wahlSchluessel] === id) return;
      if (aktiv.current) {
        aktiv.current = false;
        setAuswahl(wahl => wahl && { ...wahl, offen: false });
      }
      amSchliessen.current = false;
    }
    window.addEventListener('popstate', zurueck);
    return () => window.removeEventListener('popstate', zurueck);
  }, [id, laeuft]);

  function oeffnen(feld: HTMLInputElement) {
    const art = passendeArt(feld);
    if (!art || aktiv.current || amSchliessen.current && window.history.state?.[wahlSchluessel] === id) return false;
    amSchliessen.current = false;
    const titel = label || feld.getAttribute('aria-label') || feld.labels?.[0]?.querySelector('.kr-feld-label')?.textContent
      || feld.labels?.[0]?.textContent || (art === 'date' ? copy.datum : art === 'time' ? copy.uhrzeit : copy.wert);
    window.history.pushState({ [wahlSchluessel]: id }, '');
    aktiv.current = true;
    const wert = art === 'time' ? feld.value.slice(0, 5) : feld.value;
    setAuswahl({ art, feld, titel: titel.trim(), wert, offen: true });
    return true;
  }
  function schliessen() {
    if (!aktiv.current) return;
    aktiv.current = false;
    setAuswahl(wahl => wahl && { ...wahl, offen: false });
    if (window.history.state?.[wahlSchluessel] === id) {
      amSchliessen.current = true;
      window.history.back();
    }
  }
  function setzen(wert: string) {
    if (!auswahl?.offen || !auswahl.feld.isConnected || !passendeArt(auswahl.feld) || !erprobe(auswahl.feld)(wert)) return;
    onWert(auswahl.feld, wert);
    schliessen();
  }
  const Komponente = auswahl?.art === 'date' ? Datum : auswahl?.art === 'time' ? Zeit : Zahl;
  const waehler = auswahl && createPortal(<Komponente auswahl={auswahl}
    dialog={{ offen: auswahl.offen, titel: auswahl.titel, oeffner: auswahl.feld,
      schliessenText: copy.abbrechen, onSchliessen: schliessen, onGeschlossen: () => setAuswahl(null) }}
    onWert={setzen} />, document.body);
  return {
    waehler,
    onClick(event: MouseEvent<HTMLInputElement>) {
      if (event.currentTarget === letzterTouch.current) {
        letzterTouch.current = null;
        event.preventDefault();
      } else if (!event.defaultPrevented && window.matchMedia?.('(max-width: 620px), (pointer: coarse)').matches
        && oeffnen(event.currentTarget)) event.preventDefault();
    },
    onPointerDown(event: PointerEvent<HTMLInputElement>) {
      letzterTouch.current = null;
      if (!event.defaultPrevented && event.pointerType === 'touch' && event.isPrimary && event.button === 0
        && passendeArt(event.currentTarget)) {
        gedrueckt.current = { feld: event.currentTarget, id: event.pointerId, x: event.clientX, y: event.clientY };
        event.preventDefault();
      }
    },
    onPointerUp(event: PointerEvent<HTMLInputElement>) {
      const touch = gedrueckt.current;
      gedrueckt.current = null;
      if (!event.defaultPrevented && touch?.id === event.pointerId && touch.feld === event.currentTarget
        && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) <= 10 && oeffnen(event.currentTarget)) {
        letzterTouch.current = event.currentTarget;
        event.preventDefault();
      }
    },
    onPointerCancel() { gedrueckt.current = null; },
    onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (!event.defaultPrevented && !event.nativeEvent.isComposing && (event.key === 'F4' || event.altKey && event.key === 'ArrowDown')
        && oeffnen(event.currentTarget)) event.preventDefault();
    },
  };
}

/** Erhält die vorhandenen Input-Attribute und den normalen Change-Weg. */
export function EingabeMitWahl({ ref, wahlLabel, onClick, onPointerDown, onPointerUp, onPointerCancel, onKeyDown, ...props }:
  InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement>; wahlLabel?: string }) {
  const wahl = useEingabewahl((feld, wert) => {
    if (feld.value === wert) return;
    // Den Browserwert setzen, damit React denselben Change-Weg wie bei Eingabe per Tastatur nutzt.
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!valueSetter) return;
    valueSetter.call(feld, wert);
    feld.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }, wahlLabel);
  return <>
    <input {...props} ref={ref}
      onClick={event => { onClick?.(event); wahl.onClick(event); }}
      onPointerDown={event => { onPointerDown?.(event); wahl.onPointerDown(event); }}
      onPointerUp={event => { onPointerUp?.(event); wahl.onPointerUp(event); }}
      onPointerCancel={event => { onPointerCancel?.(event); wahl.onPointerCancel(); }}
      onKeyDown={event => { onKeyDown?.(event); wahl.onKeyDown(event); }} />
    {wahl.waehler}
  </>;
}
