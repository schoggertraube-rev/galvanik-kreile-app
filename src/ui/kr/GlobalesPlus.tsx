'use client';
import { Icon } from './Icon';
import {useVorfinalStyle} from '@/ui/useVorfinalStyle';
import {VORFINAL_COPY} from '@/ui/situationCatalog';
import {Glasknopf} from './design-final/Glasknopf';
export interface GlobalesPlusProps { onOeffnen: () => void; }
/** Ein kanonischer Einstieg in „Neu erfassen“; Folgeentscheidungen liegen im Eingang. */
export function GlobalesPlus({ onOeffnen }: GlobalesPlusProps) {
  const vorfinal=useVorfinalStyle();
  const label=vorfinal ? VORFINAL_COPY['vorfinal.kopf.plus.label'] : 'Neu erfassen';
  return <Glasknopf form="quadrat" ton="erfassung" icon={<Icon name="plus"/>} bezeichnung={label} title={label}
    data-open="plus" data-spec-id={vorfinal ? 'kopf.plus' : 'navigation.plus'} onClick={onOeffnen}/>;
}
