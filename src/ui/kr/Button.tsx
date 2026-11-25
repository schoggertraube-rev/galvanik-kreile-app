'use client';
import type { ButtonHTMLAttributes } from 'react';
import {useVorfinalStyle} from '@/ui/useVorfinalStyle';
import { Icon, type IconName, type VorfinalIconName } from './Icon';
import { cx } from './typen';
import { tippen } from './haptik';
import { Glasknopf, type GlasknopfProps } from './design-final/Glasknopf';
export type ButtonArt = 'standard' | 'primaer' | 'sekundaer' | 'gefaehrlich' | 'erledigen' | 'marke' | 'leise';
export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>&{
  art?: ButtonArt; text?: string; /** Pflicht bei Icon-only */ label?: string; block?: boolean;
  /** S19 opts into original btn2 markup; existing area callers stay unchanged. */
}&({vorfinalForm?:'pill';icon?:IconName}|{vorfinalForm:'icon';icon?:IconName&VorfinalIconName});
const toene = {
  standard: 'sekundaer', primaer: 'haupt', sekundaer: 'sekundaer',
  gefaehrlich: 'kritisch', erledigen: 'haupt', marke: 'erfassung', leise: 'leise',
} satisfies Record<ButtonArt, GlasknopfProps['ton']>;

export function Button({ art = 'standard', icon, text, label, block, className, type = 'button', onClick, vorfinalForm, 'aria-label': ariaLabel, ...rest }: ButtonProps) {
  const vorfinal = useVorfinalStyle();
  const haptisch = art === 'primaer' || art === 'erledigen' || art === 'marke';
  const symbol = icon && (vorfinal && vorfinalForm === 'icon'
    ? <Icon name={icon} variant="vorfinal" /> : <Icon name={icon} />);
  const beschriftung = text
    ? { form: 'text' as const, text, bezeichnung: ariaLabel }
    : { form: 'quadrat' as const, bezeichnung: ariaLabel ?? label ?? '' };
  return <Glasknopf {...rest} {...beschriftung} type={type} ton={toene[art]} icon={symbol}
    endIcon={text && art === 'primaer' ? <Icon name="arrow" /> : undefined}
    title={rest.title ?? (text ? undefined : label)} volleBreite={block}
    className={cx('kr-btn', art !== 'standard' && 'kr-btn--' + art, !text && 'kr-btn--icon', block && 'kr-btn--block', className)}
    onClick={event => { if (haptisch) tippen(); onClick?.(event); }} />;
}
