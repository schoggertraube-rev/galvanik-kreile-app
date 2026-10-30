'use client';
import { useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { Icon } from './Icon';
import { cx } from './typen';
export interface WischbarProps {
  /** Text der Hauptaktion (sichtbar beim Wischen nach rechts) */ rechtsText: string;
  /** rechts = Hauptaktion; die App zeigt danach Toast mit „Rückgängig“ */ onRechts: () => void;
  /** links = Später → öffnet Zeitwahl (V8 S1), nie fest „heute 14:00“ */ onLinks: () => void;
  /** Schwelle in px, Standard 90 */ schwelle?: number;
  children: ReactNode;
}
/** V1.1 B5: Wischen NUR bei Touch (pointerType 'touch') und nur ZUSÄTZLICH zu sichtbaren Knöpfen.
 *  Nicht verwenden für Freigaben und Geld – die App gibt dann kein Wischbar. Vertikales Scrollen bleibt frei (touch-action: pan-y). */
export function Wischbar({ rechtsText, onRechts, onLinks, schwelle = 90, children }: WischbarProps) {
  const start = useRef<{ x: number; y: number; an: boolean } | null>(null);
  const [dx, setDx] = useState(0);
  const unten = (e: PointerEvent<HTMLDivElement>) => { if (e.pointerType !== 'touch' || (e.target as HTMLElement).closest('button')) return; start.current = { x: e.clientX, y: e.clientY, an: false }; };
  const zieh = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current; if (!s) return;
    const x = e.clientX - s.x, y = e.clientY - s.y;
    if (!s.an) { if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) { start.current = null; return; } if (Math.abs(x) < 10) return; s.an = true; }
    setDx(x);
  };
  const los = () => { const s = start.current; start.current = null; const x = dx; setDx(0); if (!s?.an) return; if (x > schwelle) onRechts(); else if (x < -schwelle) onLinks(); };
  return (
    <div className={cx('kr-wisch', dx !== 0 && 'kr-wisch--zieh')} onPointerDown={unten} onPointerMove={zieh} onPointerUp={los} onPointerCancel={los}>
      <div className={cx('kr-wisch-bg', dx > 0 && 'kr-wisch-bg--rechts', dx < 0 && 'kr-wisch-bg--links')} aria-hidden="true"><span><Icon name="check" />{rechtsText}</span><span>Später <Icon name="clock" /></span></div>
      <div style={{ transform: dx ? 'translateX(' + dx + 'px)' : undefined }}>{children}</div>
    </div>
  );
}
