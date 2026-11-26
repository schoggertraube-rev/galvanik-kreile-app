import type {NavigationsEintrag} from './register';
export const FUNDAMENT_NAVIGATION = [{id:'tag',text:'Dein Tag',icon:'sun',route:'/',pfad:null,dockText:'Dein Tag',platz:'liste'}] as const satisfies readonly NavigationsEintrag[];
export const FUNDAMENT_NAVIGATION_UNTEN = [{id:'einstellungen',text:'Einstellungen',icon:'settings',route:'/settings',pfad:'/settings',dockText:null,platz:'unten'}] as const satisfies readonly NavigationsEintrag[];
