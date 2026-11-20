'use client';
import type { ButtonHTMLAttributes } from 'react';
import {useVorfinalStyle} from '@/ui/useVorfinalStyle';
import { Icon, type IconName, type VorfinalIconName } from './Icon';
import { cx } from './typen';
import { tippen } from './haptik';
export type ButtonArt = 'standard' | 'primaer' | 'sekundaer' | 'gefaehrlich' | 'erledigen' | 'marke' | 'leise';
export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>&{
  art?: ButtonArt; text?: string; /** Pflicht bei Icon-only */ label?: string; block?: boolean;
  /** S19 opts into original btn2 markup; existing area callers stay unchanged. */
}&({vorfinalForm?:'pill';icon?:IconName}|{vorfinalForm:'icon';icon?:IconName&VorfinalIconName});
/** Touch-Ziel ≥ 48px. primär = Navy · erledigen = Grün · gefährlich = RAL-Rot · Marke = Verlauf */
export function Button({ art = 'standard', icon, text, label, block, className, type = 'button', onClick, vorfinalForm, ...rest }: ButtonProps) {
  const vorfinal=useVorfinalStyle();
  const haptisch = art === 'primaer' || art === 'erledigen' || art === 'marke';
  // v10 act(label, attrs): unchanged default arrow, nub and completion SVG.
  // Existing flow text, disabled state and callback remain the actual command.
  if(vorfinal && text && (art==='primaer'||art==='erledigen'))return (
    <button type={type} className={cx('act',className)} data-glass="act" data-tint="go"
      onClick={event=>{if(haptisch)tippen();onClick?.(event);}} {...rest}>
      <span className="lbl">{text}</span><span className="nub"><Icon variant="vorfinal" name="arrow"/></span>
      <svg className="okmark" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
    </button>
  );
  const pill=vorfinal&&vorfinalForm==='pill';
  const iconForm=vorfinal&&vorfinalForm==='icon';
  return (
    <button type={type} aria-label={text ? undefined : label} title={text ? undefined : label}
      data-glass={pill?'pill':undefined}
      className={iconForm?cx('ib',className):pill?cx('btn2',className):cx('kr-btn', art !== 'standard' && 'kr-btn--' + art, !text && 'kr-btn--icon', block && 'kr-btn--block', className)}
      onClick={e => { if (haptisch) tippen(); onClick?.(e); }} {...rest}>
      {icon && (vorfinal&&vorfinalForm==='icon'?<Icon name={icon} variant="vorfinal"/>:<Icon name={icon}/>)}{text}
    </button>
  );
}
