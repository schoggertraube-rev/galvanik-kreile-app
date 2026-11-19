import type {PackageSwitchValues} from '@/modules/fundament/public';
import legacy from '@/ui/generated/legacyStyle.json';
import vorfinal from '@/ui/generated/vorfinalCss.json';

/** Already authorized DB projection only; no browser override or new permission. */
export function readRootStyle(status:string,switches?:Readonly<PackageSwitchValues>){
 const enabled=status==='authenticated'&&switches?.ui_v45===true;
 return {
  enabled,
  dataUi:enabled?'v45':undefined,
  css:enabled?vorfinal.css:legacy.css,
 } as const;
}
