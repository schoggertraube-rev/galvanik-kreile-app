import type {NavigationsEintrag} from './register';
export const EINGANG_NAVIGATION = [{id:'nachrichten',text:'Nachrichten',icon:'mail',route:'/nachrichten',pfad:'/nachrichten',dockText:null,platz:'liste'}] as const satisfies readonly NavigationsEintrag[];
