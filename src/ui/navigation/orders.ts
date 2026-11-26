import type {NavigationsEintrag} from './register';
export const ORDERS_NAVIGATION = [{id:'auftraege',text:'Aufträge',icon:'list',route:'/orders',pfad:'/orders',dockText:'Aufträge',platz:'liste'}] as const satisfies readonly NavigationsEintrag[];
export const ORDER_WEEK_NAVIGATION = {id:'planung',text:'Planung',pfad:ORDERS_NAVIGATION[0].pfad,view:'woche',dockSpalte:4} as const;
export const ORDER_WEEK_ROUTE = `${ORDER_WEEK_NAVIGATION.pfad}?view=${ORDER_WEEK_NAVIGATION.view}`;
