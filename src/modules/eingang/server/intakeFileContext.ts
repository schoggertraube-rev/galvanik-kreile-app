import 'server-only';
import {canChangeEvidenceVisibility,hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {readGoodsReceiptOrder} from '@/lib/server/goodsReceiptOrderPort';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {IntakeFileContext} from '../captureContract';

export type StoredIntakeFileContext = IntakeFileContext & {kundeId:string};
export type IntakeFileCustomerReader = (tx:PrivilegedTenantTransaction,tenantId:string,id:string)=>Promise<{id:string}|null>;

export function mayCaptureContextFile(auth:AuthorizationSnapshot,context?:IntakeFileContext){
  return auth.permissions.includes('perm_op_photos')&&(context
    ? hasAuthorizationArea(auth,context.auftragId?'auftraege':'kunden')&&
      (!context.fuerKunde||canChangeEvidenceVisibility(auth,'INTAKE_FILE'))
    : hasAuthorizationArea(auth,'auftraege')||hasAuthorizationArea(auth,'kunden'));
}

export async function qualifyIntakeFileContext(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,
  context:IntakeFileContext,readCustomer?:IntakeFileCustomerReader):Promise<StoredIntakeFileContext|null> {
  const intent=Object.fromEntries(Object.entries(context).filter(([,value])=>value!==undefined)) as IntakeFileContext;
  if(context.auftragId){
    const order=await readGoodsReceiptOrder(tx,auth,context.auftragId);
    if(!order||context.kundeId&&order.customerId!==context.kundeId||
      context.teilId&&!order.items.some(item=>item.id===context.teilId))return null;
    return {...intent,kundeId:order.customerId};
  }
  const customer=context.kundeId&&readCustomer?await readCustomer(tx,auth.tenantId,context.kundeId):null;
  return customer?{...intent,kundeId:customer.id}:null;
}
