import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './typen';
import { tippen } from './haptik';
export type ButtonArt = 'standard' | 'primaer' | 'sekundaer' | 'gefaehrlich' | 'erledigen' | 'marke' | 'leise';
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  art?: ButtonArt; icon?: IconName; text?: string; /** Pflicht bei Icon-only */ label?: string; block?: boolean;
}
/** Touch-Ziel ≥ 48px. primär = Navy · erledigen = Grün · gefährlich = RAL-Rot · Marke = Verlauf */
export function Button({ art = 'standard', icon, text, label, block, className, type = 'button', onClick, ...rest }: ButtonProps) {
  const haptisch = art === 'primaer' || art === 'erledigen' || art === 'marke';
  return (
    <button type={type} aria-label={text ? undefined : label} title={text ? undefined : label}
      className={cx('kr-btn', art !== 'standard' && 'kr-btn--' + art, !text && 'kr-btn--icon', block && 'kr-btn--block', className)}
      onClick={e => { if (haptisch) tippen(); onClick?.(e); }} {...rest}>
      {icon && <Icon name={icon} />}{text}
    </button>
  );
}
