import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from './typen';
export interface FeldProps { label: string; fehler?: string; voll?: boolean; className?: string; children: ReactNode; }
/** Label (10,5px, Versal) + Steuerelement + optional Fehler. Keine Hilfetexte (§6.4). */
export function Feld({ label, fehler, voll, className, children }: FeldProps) {
  return <label className={cx('kr-feld', fehler && 'kr-feld--fehler', voll && 'kr-voll', className)}><span className="kr-feld-label">{label}</span>{children}{fehler && <span className="kr-feld-fehler">{fehler}</span>}</label>;
}
export function Eingabe(p: InputHTMLAttributes<HTMLInputElement>) { return <input {...p} className={cx('kr-eingabe', p.className)} />; }
export interface AuswahlOption { wert: string; text: string; gesperrt?: boolean; }
export function Auswahl({ optionen, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { optionen: AuswahlOption[] }) {
  return <select {...p} className={cx('kr-auswahl', p.className)}>{optionen.map(o => <option key={o.wert} value={o.wert} disabled={o.gesperrt}>{o.text}</option>)}</select>;
}
export function Textfeld(p: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...p} className={cx('kr-textfeld', p.className)} />; }
export interface CheckboxProps { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean; }
export function Checkbox({ checked, onChange, children, disabled }: CheckboxProps) {
  return <label className="kr-check"><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span>{children}</span></label>;
}
export interface SegmentProps<T extends string> { optionen: Array<{ wert: T; text: string; gesperrt?: boolean }>; wert: T; onWert: (v: T) => void; label?: string; }
export function Segment<T extends string>({ optionen, wert, onWert, label }: SegmentProps<T>) {
  return <div className="kr-segment" role="group" aria-label={label}>{optionen.map(o => <button key={o.wert} type="button" aria-pressed={o.wert === wert} disabled={o.gesperrt} onClick={() => onWert(o.wert)}>{o.text}</button>)}</div>;
}
export function FormRaster({ spalten = 2, children }: { spalten?: 2 | 3; children: ReactNode }) { return <div className={cx('kr-form', spalten === 3 && 'kr-form--3')}>{children}</div>; }
