import 'server-only';
import {V45_RUNTIME} from '@/ui/v45.generated';
import {ROLE_LABELS,type AccessArea} from '@/lib/auth/authorizationContract';
import {readActiveAreaHolders,type AuthorizationSnapshot} from './authorization';
import {readOrderTaskAssignment} from './orderTaskAssignmentRead';
import {withPrivilegedTenantTransaction} from './privilegedDb';

/** PL06:01: actual assignment, unique effective login, then the existing role label. */
export async function readV45ResponsibilityText(auth:AuthorizationSnapshot,input:{textKey:string;requiredArea:AccessArea;orderId?:string}){
 const template=V45_RUNTIME.texte[input.textKey]?.text;
 if(typeof template!=='string'||!template.includes('{zustaendig}'))return {code:'VALIDATION_ERROR' as const};
 let name:string|undefined,source:'assignment'|'login'|'role'|undefined;
 if(input.orderId){
  const assignment=await readOrderTaskAssignment(auth,{orderId:input.orderId});
  if(assignment.code!=='OK')return {code:assignment.code};
  if(assignment.data?.active){name=assignment.data.assignedToName.trim();source='assignment';}
 }
 if(!source){
  const holders=await withPrivilegedTenantTransaction(auth,tx=>readActiveAreaHolders(tx,auth.tenantId,input.requiredArea));
  if(holders.length===1){name=holders[0].name.trim();source='login';}
  else if(holders.length>1){
   const roles=new Set(holders.map(holder=>holder.role));
   const labels=[...new Set(Object.entries(ROLE_LABELS).filter(([role])=>roles.has(role as typeof holders[number]['role'])).map(([,label])=>label))];
   name=labels.join(' oder ');source='role';
  }
 }
 if(!name||!source)return {code:'SOURCE_INCOMPLETE' as const,missing:'RESPONSIBLE_NAME' as const};
 return {code:'OK' as const,text:template.replaceAll('{zustaendig}',name),textKey:input.textKey,source};
}
