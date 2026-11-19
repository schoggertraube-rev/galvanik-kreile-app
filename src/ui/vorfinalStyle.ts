import type {PackageSwitchValues} from '@/modules/fundament/public';

/** Already authorized DB projection only; no browser override or new permission. */
export function readRootStyle(status:string,switches?:Readonly<PackageSwitchValues>){
 const enabled=status==='authenticated'&&switches?.ui_v45===true;
 return {
  enabled,
  dataUi:enabled?'v45':undefined,
  href:enabled?'/styles/vorfinal-v10.css':'/styles/endversion-legacy.css',
 } as const;
}
