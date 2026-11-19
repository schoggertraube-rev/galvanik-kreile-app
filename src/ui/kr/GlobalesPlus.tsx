'use client';
import { Icon } from './Icon';
import {usePermissions} from '@/lib/auth/PermissionsContext';
import {VORFINAL_COPY} from '@/ui/situationCatalog';
export interface GlobalesPlusProps { onOeffnen: () => void; }
/** Ein kanonischer Einstieg in „Neu erfassen“; Folgeentscheidungen liegen im Eingang. */
export function GlobalesPlus({ onOeffnen }: GlobalesPlusProps) {
  const {packageSwitches}=usePermissions();
  if(packageSwitches?.ui_v45===true)return (
    <button type="button" className="plus" data-glass="act" data-tint="plus" data-open="plus" aria-label={VORFINAL_COPY['vorfinal.kopf.plus.label']} data-spec-id="kopf.plus" onClick={onOeffnen}>
      <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
    </button>
  );
  return (
    <div style={{ position: 'relative' }}>
      <button data-spec-id="navigation.plus" type="button" className="kr-plus" aria-label="Neu erfassen" title="Neu erfassen" onClick={onOeffnen}><Icon name="plus" /></button>
    </div>
  );
}
