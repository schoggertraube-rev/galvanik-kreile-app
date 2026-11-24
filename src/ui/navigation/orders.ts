import type {NavigationsEintrag} from './register';
export const ORDERS_NAVIGATION = [{id:'auftraege',text:'Aufträge',icon:'list',route:'/orders',pfad:'/orders',dockText:'Aufträge',platz:'liste'}] as const satisfies readonly NavigationsEintrag[];
