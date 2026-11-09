/** Test-only evidence judge. Callers read the changed row and new events from the real replay DB. */
export function writeActorAudit(input:{before:unknown;after:unknown;actorId:string;events:readonly {user_id:string|null;status:string}[]}){
 if(JSON.stringify(input.before)===JSON.stringify(input.after))return {code:'NO_CHANGE' as const};
 if(!input.events.some(event=>event.status==='success'&&event.user_id===input.actorId))return {code:'WRITE_WITHOUT_LOGIN_EVENT' as const};
 return {code:'OK' as const};
}
