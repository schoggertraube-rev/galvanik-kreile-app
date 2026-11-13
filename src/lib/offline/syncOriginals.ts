import {syncPendingFiles} from './syncPendingFiles';
import {replayOfflineWorkshopHttp} from './replayWorkshopHttp';

/** One queue and existing command ports for reconnect, explicit retry and exit. */
export function syncOriginals(scope:string,currentScope:()=>string|null,options:{flushDelayed?:boolean;workshopOnly?:boolean;keepalive?:boolean}={}){
 // Preserve synchronous queue/exit dispatch; only the used Action port loads
 // its server reference. Workshop keepalive never waits for an intake chunk.
 const saveIntakeNoteAction=async(...args:Parameters<typeof import('@/app/actions/eingang.actions').saveIntakeNoteAction>)=>(await import('@/app/actions/eingang.actions')).saveIntakeNoteAction(...args);
 const prepareIntakeFileAction=async(...args:Parameters<typeof import('@/app/actions/eingang.actions').prepareIntakeFileAction>)=>(await import('@/app/actions/eingang.actions')).prepareIntakeFileAction(...args);
 const finishIntakeFileAction=async(...args:Parameters<typeof import('@/app/actions/eingang.actions').finishIntakeFileAction>)=>(await import('@/app/actions/eingang.actions')).finishIntakeFileAction(...args);
 const uploadIntakeOriginal=async(...args:Parameters<typeof import('@/modules/eingang/public').uploadIntakeOriginal>)=>(await import('@/modules/eingang/public')).uploadIntakeOriginal(...args);
 return syncPendingFiles(scope,{saveNote:saveIntakeNoteAction,prepare:prepareIntakeFileAction,finish:finishIntakeFileAction,upload:uploadIntakeOriginal,currentScope,workshop:(partition,original)=>replayOfflineWorkshopHttp(partition,original,{keepalive:options.keepalive}),workshopAcknowledged:proof=>window.dispatchEvent(new CustomEvent('kreile-workshop-acknowledged',{detail:proof}))},options);
}
