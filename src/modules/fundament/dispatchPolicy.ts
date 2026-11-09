export const DISPATCH_DAY_FIELDS=['reminderDays','secondReminderDays','callAfterDays','storageAfterDays','blockAfterDueDays','unconfirmedDeliveryDays'] as const;
export type DispatchPolicy={reminderDays:number|null;secondReminderDays:number|null;callAfterDays:number|null;storageAfterDays:number|null;blockAfterDueDays:number|null;unconfirmedDeliveryDays:number|null;holdMinutes:number|null;pickupWindows:Array<{day:number;start:string;end:string}>;holidays:string[];carrierCutoffs:Array<{service:string;day:number;time:string}>;fallbackService:string|null};
export const emptyDispatchPolicy=():DispatchPolicy=>({reminderDays:null,secondReminderDays:null,callAfterDays:null,storageAfterDays:null,blockAfterDueDays:null,unconfirmedDeliveryDays:null,holdMinutes:null,pickupWindows:[],holidays:[],carrierCutoffs:[],fallbackService:null});
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:object,keys:string[])=>Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const time=(v:unknown):v is string=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const day=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=6;
const days=(v:unknown,max:number)=>v===null||Number.isInteger(v)&&Number(v)>=0&&Number(v)<=max;
export function dispatchPolicyValid(v:unknown):v is DispatchPolicy{
 if(!object(v)||!exact(v,Object.keys(emptyDispatchPolicy()))||!DISPATCH_DAY_FIELDS.every(key=>days(v[key],3650))||!days(v.holdMinutes,1440)||!(v.fallbackService===null||typeof v.fallbackService==='string'&&v.fallbackService===v.fallbackService.trim()&&v.fallbackService.length>0&&v.fallbackService.length<=40))return false;
 if(!Array.isArray(v.pickupWindows)||v.pickupWindows.length>7||!v.pickupWindows.every(row=>object(row)&&exact(row,['day','start','end'])&&day(row.day)&&time(row.start)&&time(row.end)&&row.start<row.end)||new Set(v.pickupWindows.map(row=>row.day)).size!==v.pickupWindows.length)return false;
 if(!Array.isArray(v.holidays)||v.holidays.length>366||new Set(v.holidays).size!==v.holidays.length||!v.holidays.every(value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value))return false;
 return Array.isArray(v.carrierCutoffs)&&v.carrierCutoffs.length<=70&&v.carrierCutoffs.every(row=>object(row)&&exact(row,['service','day','time'])&&typeof row.service==='string'&&row.service===row.service.trim()&&row.service.length>0&&row.service.length<=40&&day(row.day)&&time(row.time))&&new Set(v.carrierCutoffs.map(row=>row.service.toLowerCase()+':'+row.day)).size===v.carrierCutoffs.length;
}
