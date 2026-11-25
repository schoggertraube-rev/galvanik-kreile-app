'use client';

// Ersetzt/erweitert src/ui/kr/Dialog.tsx und src/ui/kr/Seitenblatt.tsx.
import { useId, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import styles from './GlasDialog.module.css';

export interface GlasDialogProps {
  offen: boolean;
  titel: string;
  beschreibung?: ReactNode;
  ansicht?: 'fenster' | 'blatt' | 'objekt' | 'zeitwahl' | 'zahlwahl';
  groesse?: 'kompakt' | 'normal' | 'antwort' | 'akte' | 'breit';
  schliessenText: string;
  schliessenSymbol?: ReactNode;
  schliessenStil?: 'knopf' | 'text';
  schliesstGesperrt?: boolean;
  beschaeftigt?: boolean;
  onSchliessen: () => void;
  onGeschlossen?: () => void;
  fokus?: RefObject<HTMLElement | null>;
  /** Den ausgelösten Knopf als event.currentTarget übergeben. WebKit fokussiert Touch-Knöpfe nicht automatisch. */
  oeffner: HTMLElement | null;
  kopfAktionen?: ReactNode;
  kopfSymbol?: ReactNode;
  kopfVerborgen?: boolean;
  nebenKopf?: boolean;
  dataSpecId?: string;
  schliessenSpecId?: string;
  fuss?: ReactNode;
  children: ReactNode;
}

export function isTopGlassDialog(element: HTMLElement | null) {
  const visible = [...document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"]:not(dialog)')]
    .filter(dialog => !dialog.closest('[hidden], [aria-hidden="true"]') && getComputedStyle(dialog).display !== 'none');
  return visible.at(-1) === element;
}

export function GlasDialog({
  offen, titel, beschreibung, ansicht = 'fenster', groesse = 'normal', schliessenText, schliessenSymbol,
  schliessenStil = 'knopf', schliesstGesperrt, beschaeftigt, onSchliessen,
  onGeschlossen, fokus, oeffner, kopfAktionen, kopfSymbol, kopfVerborgen, nebenKopf, dataSpecId, schliessenSpecId, fuss, children,
}: GlasDialogProps) {
  const element = useRef<HTMLDialogElement>(null);
  const startFokus = useRef<HTMLElement | null>(null);
  const backdropBeginn = useRef(false);
  const ziehStart = useRef<number | null>(null);
  const seitenebene = useRef<HTMLDivElement>(null);
  const aktuell = useRef({ onGeschlossen, fokus, oeffner });
  const titelId = useId();
  const beschreibungId = useId();

  useLayoutEffect(() => {
    aktuell.current = { onGeschlossen, fokus, oeffner };
  }, [onGeschlossen, fokus, oeffner]);

  useLayoutEffect(() => {
    const dialog = element.current;
    if (!dialog) return;
    let abgebrochen = false;

    function fokusZurueck() {
      if (startFokus.current?.isConnected) startFokus.current.focus({ preventScroll: true });
      startFokus.current = null;
    }

    if (offen) {
      if (!dialog.open) {
        startFokus.current = aktuell.current.oeffner ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        if (nebenKopf && typeof dialog.show === 'function') dialog.show();
        else if (!nebenKopf && typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        const initial = aktuell.current.fokus?.current
          ?? dialog.querySelector<HTMLElement>('[autofocus]:not(:disabled)')
          ?? dialog.querySelector<HTMLElement>(kopfVerborgen
            ? '[data-overlay-body] :is(button:not(:disabled), a[href], input:not(:disabled))'
            : '[data-dialog-erster-fokus]:not(:disabled)');
        initial?.focus({ preventScroll: true });
      }
    } else if (dialog.open) {
      function abschliessen() {
        if (abgebrochen || !dialog?.open) return;
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
        fokusZurueck();
        aktuell.current.onGeschlossen?.();
      }
      const animationen = dialog.getAnimations?.({ subtree: false }) ?? [];
      if (animationen.length) void Promise.allSettled(animationen.map((animation) => animation.finished)).then(abschliessen);
      else abschliessen();
    }

    return () => { abgebrochen = true; };
  }, [offen, nebenKopf, kopfVerborgen]);

  useLayoutEffect(() => {
    const dialog = element.current;
    return () => {
      if (dialog?.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
      if (startFokus.current?.isConnected) startFokus.current.focus({ preventScroll: true });
      startFokus.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const dialog = element.current;
    if (!dialog || (!nebenKopf && typeof dialog.showModal === 'function')) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !offen || !isTopGlassDialog(dialog)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!schliesstGesperrt) onSchliessen();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [nebenKopf, offen, onSchliessen, schliesstGesperrt]);

  useLayoutEffect(() => {
    const rahmen = seitenebene.current;
    const header = document.querySelector<HTMLElement>('.kr-kopf');
    if (!nebenKopf || !rahmen || !header) return;
    const ausrichten = () => rahmen.style.setProperty('--r53-app-kopf-ende', `${header.getBoundingClientRect().bottom}px`);
    ausrichten();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(ausrichten);
    observer?.observe(header);
    window.addEventListener('resize', ausrichten);
    return () => { observer?.disconnect(); window.removeEventListener('resize', ausrichten); };
  }, [nebenKopf]);

  useLayoutEffect(() => {
    const dialog = element.current;
    const viewport = window.visualViewport;
    if (!offen || !dialog || !viewport) return;
    let frame = 0;

    function reset() {
      dialog?.removeAttribute('data-r53-sichtfenster');
      dialog?.style.removeProperty('--r53-form-visible-height');
      dialog?.style.removeProperty('--r53-form-visible-top');
    }

    function aktualisieren() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!dialog || !viewport) return;
        const aktiv = document.activeElement;
        const schreibt = dialog.contains(aktiv) && aktiv?.matches('textarea:not([readonly]), input:not([readonly]):is([type=text],[type=email],[type=search],[type=tel],[type=url],[type=password]), [contenteditable="true"]');
        if (!schreibt || viewport.height >= window.innerHeight) { reset(); return; }
        dialog.setAttribute('data-r53-sichtfenster', '');
        dialog.style.setProperty('--r53-form-visible-height', viewport.height + 'px');
        dialog.style.setProperty('--r53-form-visible-top', viewport.offsetTop + 'px');
        const feld = aktiv?.getBoundingClientRect();
        if (feld && (feld.top < viewport.offsetTop || feld.bottom > viewport.offsetTop + viewport.height)) {
          aktiv?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      });
    }

    dialog.addEventListener('focusin', aktualisieren);
    dialog.addEventListener('focusout', aktualisieren);
    viewport.addEventListener('resize', aktualisieren);
    viewport.addEventListener('scroll', aktualisieren);
    return () => {
      cancelAnimationFrame(frame);
      dialog.removeEventListener('focusin', aktualisieren);
      dialog.removeEventListener('focusout', aktualisieren);
      viewport.removeEventListener('resize', aktualisieren);
      viewport.removeEventListener('scroll', aktualisieren);
      reset();
    };
  }, [offen]);

  function schliessen() {
    if (offen && !schliesstGesperrt) onSchliessen();
  }

  const dialog = (
    <dialog
      ref={element}
      className={styles.dialog}
      role="dialog"
      aria-modal={!nebenKopf}
      aria-labelledby={titelId}
      aria-describedby={beschreibung ? beschreibungId : undefined}
      aria-busy={beschaeftigt || undefined}
      data-r53-form={ansicht}
      data-r53-neben-kopf={nebenKopf || undefined}
      data-spec-id={dataSpecId}
      data-r53-groesse={groesse}
      data-r53-ausgang={offen ? undefined : ''}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); schliessen(); }}
      onPointerDown={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        backdropBeginn.current = event.target === event.currentTarget && (
          event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom
        );
      }}
      onPointerCancel={() => { backdropBeginn.current = false; }}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const endetDraussen = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
        const nebenDialog = backdropBeginn.current && event.target === event.currentTarget && endetDraussen;
        backdropBeginn.current = false;
        if (nebenDialog) schliessen();
      }}
    >
      <div aria-hidden="true" className={styles.griff}
        onPointerDown={event => { ziehStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerCancel={() => { ziehStart.current = null; }}
        onPointerUp={event => {
          if (ziehStart.current !== null && event.clientY - ziehStart.current >= 44) schliessen();
          ziehStart.current = null;
        }} />
      <header className={kopfVerborgen ? 'kr-sr' : styles.kopf}>
        {kopfSymbol}
        <div className={styles.titelgruppe}>
          <h2 id={titelId} className={styles.titel}>{titel}</h2>
          {beschreibung && <div id={beschreibungId}>{beschreibung}</div>}
          {kopfAktionen}
        </div>
        <button
          type="button"
          className={styles.schliessen}
          data-r53-schliessen={schliessenSymbol ? schliessenStil : 'text'}
          data-dialog-erster-fokus
          data-overlay-close
          data-spec-id={schliessenSpecId}
          aria-label={schliessenText}
          onClick={schliessen}
          disabled={schliesstGesperrt}
          tabIndex={kopfVerborgen ? -1 : undefined}
        >{schliessenSymbol ?? schliessenText}</button>
      </header>
      <div className={styles.inhalt} data-overlay-body>{children}</div>
      {fuss && <footer className={styles.fuss} data-dialog-actions inert={beschaeftigt}>{fuss}</footer>}
    </dialog>
  );
  return nebenKopf ? <div ref={seitenebene} className={styles.seitenebene}
    style={{ '--r53-app-kopf-ende': 'var(--kopf)' } as CSSProperties}>
    <div className={styles.seitenhintergrund} aria-hidden="true" onClick={schliessen} />
    {dialog}
  </div> : dialog;
}
