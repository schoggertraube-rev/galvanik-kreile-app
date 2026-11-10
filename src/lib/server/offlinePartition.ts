import 'server-only';
import {createHash} from 'node:crypto';
/** Local partition only: no identity, credential or authority is granted by this hash. */
export function offlinePartition(auth:{tenantId:string;userId:string}){
 return createHash('sha256').update(`intake-pending:${auth.tenantId}:${auth.userId}`).digest('hex');
}
