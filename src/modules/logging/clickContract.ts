import type {ClickInput,ClickFact} from './public';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const CLICK_TARGET=/^(?:[a-z][a-z0-9._:-]{0,79}|\/(?:[a-z][a-z-]{0,39})(?:\/[a-z][a-z-]{0,39})?)$/;
const route=/^\/(?:[a-z][a-z-]{0,39}|:id)?(?:\/(?:[a-z][a-z-]{0,39}|:id)){0,4}$/;
/** Current dynamic Next routes are orders/[id] and customers/[id]. Never send those IDs. */
export function normalizeClickRoute(path:string):string|null{
 if(typeof path!=='string')return null;
 const clean=path.split(/[?#]/,1)[0],segments=clean.split('/');
 if((segments[1]==='orders'||segments[1]==='customers')&&segments.length===3)segments[2]=':id';
 const normalized=segments.join('/');return route.test(normalized)?normalized:null;
}
export function parseClick(value:unknown):ClickFact|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 if(typeof row.id!=='string'||!uuid.test(row.id)||typeof row.sessionId!=='string'||!uuid.test(row.sessionId)
  ||typeof row.target!=='string'||!CLICK_TARGET.test(row.target)||typeof row.route!=='string'
  ||!['desktop','tablet','mobile','unknown'].includes(String(row.deviceClass))
  ||row.outcome!==null&&!['success','failure','cancelled'].includes(String(row.outcome))
  ||row.durationMs!==null&&(!Number.isSafeInteger(row.durationMs)||Number(row.durationMs)<0||Number(row.durationMs)>3600000)
  ||!Number.isSafeInteger(row.clickCount)||Number(row.clickCount)<1||Number(row.clickCount)>10000
  ||typeof row.occurredAt!=='string'||!Number.isFinite(Date.parse(row.occurredAt)))return null;
 const normalized=normalizeClickRoute(row.route);if(normalized===null)return null;
 return {id:row.id,sessionId:row.sessionId,route:normalized,target:row.target,deviceClass:row.deviceClass as ClickInput['deviceClass'],
  outcome:row.outcome as ClickFact['outcome'],durationMs:row.durationMs===null?null:Number(row.durationMs),clickCount:Number(row.clickCount),occurredAt:new Date(row.occurredAt).toISOString()};
}
