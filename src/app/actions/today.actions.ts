"use server";
import {observeAction,subjectForAction} from '@/modules/logging/server-public';
import {readLoggingSettings} from '@/modules/fundament/server-public';
import {readTodayNoteTask,saveTask} from '@/modules/tasks/server-public';


import {LEGACY_ACTION_ACCESS_COPY} from '@/ui/situationCatalog';
import type { AccessArea } from "@/lib/auth/authorizationContract";
import { hasAnyAuthorizationArea, hasAuthorizationArea, resolveAuthorization } from "@/lib/server/authorization";
import { saveTodayPreferences, saveTodayReminder, type TodayLayoutItem } from "@/lib/server/todayDashboard";

async function auth(requiredArea?: AccessArea) {
  const result = await resolveAuthorization();
  if (!result.ok) return { ok: false as const, result: { code: result.reason === "AUTHORIZATION_UNAVAILABLE" ? "UNAVAILABLE" as const : "UNAUTHENTICATED" as const, message: "Sitzung oder Berechtigung ist nicht verfügbar." } };
  if (!hasAnyAuthorizationArea(result.data) || (requiredArea && !hasAuthorizationArea(result.data, requiredArea))) return { ok: false as const, result: { code: "FORBIDDEN" as const, message: "Der Tag ist für dieses Profil nicht freigegeben." } };
  return { ok: true as const, data: result.data };
}

/** S06 thin read facade: the same U3 loader as the actual home page. */
export async function getTodayDeviceAction(){
 return observeAction('getTodayDeviceAction',subjectForAction('getTodayDeviceAction',undefined),async()=>{
 const authorization=await auth();if(!authorization.ok)return authorization.result;
 const {loadOfficeHome}=await import('@/lib/server/officeHomeRead');
 const model=await loadOfficeHome(authorization.data);
 if(model.kind==='data'||model.kind==='empty')return {code:'OK' as const,dashboard:model.dashboard,serverReadAt:model.projection.loadedAt,cacheLoginScope:model.cacheLoginScope};
 if(model.kind==='error'||model.kind==='denied')return {code:'UNAVAILABLE' as const,message:model.message};
 return {code:'FORBIDDEN' as const,message:LEGACY_ACTION_ACCESS_COPY.forbidden};

 },readLoggingSettings);
}

export async function saveTodayPreferencesAction(layout: TodayLayoutItem[]) {
 return observeAction('saveTodayPreferencesAction',subjectForAction('saveTodayPreferencesAction',layout),async()=>{
  const authorization = await auth();
  if (!authorization.ok) return authorization.result;
  try { return await saveTodayPreferences(authorization.data, layout); }
  catch (error) {
    console.error("[TODAY_PREFERENCES_SAVE_FAILED]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return { code: "UNAVAILABLE" as const, message: "Die Feldauswahl konnte nicht sicher gespeichert werden. Fehlercode: TODAY_PREFERENCES_SAVE_FAILED." };
  }

 },readLoggingSettings);
}

export async function saveTodayReminderAction(input: { itemKey: string; mode: "afternoon" | "tomorrow" | "after_due"; dueDate?: string }) {
 return observeAction('saveTodayReminderAction',subjectForAction('saveTodayReminderAction',input),async()=>{
  const authorization = await auth("auftraege");
  if (!authorization.ok) return authorization.result;
  try { return await saveTodayReminder(authorization.data, input); }
  catch (error) {
    console.error("[TODAY_REMINDER_SAVE_FAILED]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return { code: "UNAVAILABLE" as const, message: "Die Erinnerung konnte nicht sicher gespeichert werden. Fehlercode: TODAY_REMINDER_SAVE_FAILED." };
  }

 },readLoggingSettings);
}

export async function readTodayOwnNoteAction(){
 return observeAction('readTodayOwnNoteAction',subjectForAction('readTodayOwnNoteAction',undefined),readTodayNoteTask,readLoggingSettings);
}

export async function saveTodayOwnNotesAction(input:{text:string;day:string;version:number}){
 return observeAction('saveTodayOwnNotesAction',subjectForAction('saveTodayOwnNotesAction',undefined),async()=>{
  const result=await saveTask(input,{todayNote:true});
  if(result.code!=='OK')return result;
  const {faellig_am:day,notiz:text,version,status}=result.task;
  return {code:'OK' as const,note:{day,text:text??'',version,completed:status==='erledigt'}};
 },readLoggingSettings);
}
