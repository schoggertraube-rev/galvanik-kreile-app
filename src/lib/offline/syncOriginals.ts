import {syncPendingFiles} from './syncPendingFiles';
import {replayOfflineWorkshopHttp} from './replayWorkshopHttp';
import {prepareIntakeFileAction,finishIntakeFileAction,saveIntakeNoteAction} from '@/app/actions/eingang.actions';
import {uploadIntakeOriginal} from '@/modules/eingang/public';

/** One queue and existing command ports for reconnect, explicit retry and exit. */
export function syncOriginals(scope:string,currentScope:()=>string|null,options:{flushDelayed?:boolean;workshopOnly?:boolean;keepalive?:boolean}={}){
 return syncPendingFiles(scope,{saveNote:saveIntakeNoteAction,prepare:prepareIntakeFileAction,finish:finishIntakeFileAction,upload:uploadIntakeOriginal,currentScope,workshop:(partition,original)=>replayOfflineWorkshopHttp(partition,original,{keepalive:options.keepalive}),workshopAcknowledged:proof=>window.dispatchEvent(new CustomEvent('kreile-workshop-acknowledged',{detail:proof}))},options);
}
