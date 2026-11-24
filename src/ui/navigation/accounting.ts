import type {NavigationsEintrag} from './register';
export const ACCOUNTING_NAVIGATION = [{id:'geld',text:'Geld & Rechnungen',icon:'euro',route:'/buchhaltung/rechnungen',pfad:'/buchhaltung/rechnungen',dockText:'Geld',platz:'liste'}] as const satisfies readonly NavigationsEintrag[];
