import type {NavigationsEintrag} from './register';
export const ACCOUNTING_NAVIGATION = [{id:'geld',text:'Zahlungen',icon:'euro',route:'/buchhaltung/rechnungen',pfad:'/buchhaltung/rechnungen',dockText:'Zahlungen',platz:'liste'}] as const satisfies readonly NavigationsEintrag[];
