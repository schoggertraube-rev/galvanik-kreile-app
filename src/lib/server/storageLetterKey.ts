import 'server-only';
import {createHash} from 'node:crypto';

export function storageLetterKey(tenantId:string,customerId:string,handover:string,callKey:string,orderIds:readonly string[]){
 const hex=createHash('sha256').update(JSON.stringify(['storage-letter',tenantId,customerId,handover,callKey,[...orderIds].sort()])).digest('hex');
 return hex.slice(0,8)+'-'+hex.slice(8,12)+'-5'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);
}
