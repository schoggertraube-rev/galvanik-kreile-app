import type {NavigationsEintrag} from './register';
export const CUSTOMERS_NAVIGATION = [{id:'kunden',text:'Kunden & Kontakt',icon:'users',route:'/customers',pfad:'/customers',dockText:'Kunden',platz:'liste'}] as const satisfies readonly NavigationsEintrag[];
