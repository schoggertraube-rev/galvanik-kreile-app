/** Browser-safe extraction of the existing manual handover intent and receipt. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function isOrderCommandBase(input: { orderId: unknown; expectedVersion: unknown; clientEventId: unknown }) {
  return typeof input.orderId === "string" && input.orderId.trim() === input.orderId && input.orderId.length >= 1 && input.orderId.length <= 128
    && typeof input.expectedVersion === "number" && Number.isSafeInteger(input.expectedVersion) && input.expectedVersion > 0
    && typeof input.clientEventId === "string" && UUID.test(input.clientEventId);
}

export type ManualHandoverInput={command:'handover_manual';orderId:string;expectedVersion:number;clientEventId:string;handoverMode:'pickup'|'shipping'};
export type ManualHandoverReceipt={eventId:string;orderId:string;orderNumber:string|null;customerId:string;
 expectedVersion:number;orderVersion:number;handoverMode:'pickup'|'shipping';requestedHandoverMode:'pickup'|'shipping';
 outcome:'changed'|'call_customer';message:string;taskClientKey:string|null;passed:boolean;taskTitle:string|null;
 actor:{kind:'login';id:string;at:string}};
export type ManualHandoverCommandReceipt=ManualHandoverReceipt&{taskId:string|null};

function record(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
export function isManualHandoverInput(value:unknown):value is ManualHandoverInput{
 return record(value)&&Object.keys(value).sort().join(',')==='clientEventId,command,expectedVersion,handoverMode,orderId'
  &&value.command==='handover_manual'&&isOrderCommandBase({orderId:value.orderId,expectedVersion:value.expectedVersion,clientEventId:value.clientEventId})
  &&(value.handoverMode==='pickup'||value.handoverMode==='shipping');
}
/** Transport shape and intent binding only; the existing server writer proves
 * the actual immutable event and, when late, its real TaskWriter history. */
export function isManualHandoverCommandReceipt(value:unknown,input:ManualHandoverInput,actorId:unknown):value is ManualHandoverCommandReceipt{
 if(!record(value)||Object.keys(value).sort().join(',')!=='actor,customerId,eventId,expectedVersion,handoverMode,message,orderId,orderNumber,orderVersion,outcome,passed,requestedHandoverMode,taskClientKey,taskId,taskTitle'
  ||typeof value.eventId!=='string'||!UUID.test(value.eventId)||value.orderId!==input.orderId
  ||typeof value.customerId!=='string'||!value.customerId.trim()||value.customerId.length>128
  ||!(value.orderNumber===null||typeof value.orderNumber==='string'&&value.orderNumber.trim().length>0)
  ||value.expectedVersion!==input.expectedVersion||typeof value.passed!=='boolean'||value.orderVersion!==input.expectedVersion+(value.passed?0:1)
  ||value.requestedHandoverMode!==input.handoverMode||!['pickup','shipping'].includes(String(value.handoverMode))
  ||typeof value.message!=='string'||!value.message.trim()||!record(value.actor)||Object.keys(value.actor).sort().join(',')!=='at,id,kind'
  ||value.actor.kind!=='login'||typeof actorId!=='string'||!UUID.test(actorId)||value.actor.id!==actorId
  ||typeof value.actor.at!=='string'||!Number.isFinite(Date.parse(value.actor.at)))return false;
 if(value.outcome==='changed')return !value.passed&&value.handoverMode===input.handoverMode&&value.taskId===null&&value.taskTitle===null&&value.taskClientKey===null;
 return value.outcome==='call_customer'&&value.taskId===value.eventId&&value.taskClientKey===input.clientEventId
  &&typeof value.taskTitle==='string'&&value.taskTitle.trim().length>0&&value.taskTitle.length<=120;
}
