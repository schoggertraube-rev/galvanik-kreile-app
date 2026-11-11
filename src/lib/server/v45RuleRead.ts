import 'server-only';
import {hasAuthorizationArea,isAccessArea} from '@/lib/auth/authorizationContract';
import type {AuthorizationSnapshot} from './authorization';
import {V45_RULES,V45_SOURCE_HASHES,V45_PREVIEW_SHA,V45_ELEMENTS} from '@/ui/v45.generated';

/** Pure reading projection. Facts must come from the existing domain read ports.
 * Unknown is never false: stop at the first still-possible higher-priority rule.
 * The ordered rules themselves remain solely in the hash-bound V45 projection.
 */
export function readV45Rule(area:string,facts:Readonly<Record<string,unknown>>){
 const rules=V45_RULES.filter(rule=>rule.bereich===area);
 if(!rules.length)return {code:'VALIDATION_ERROR' as const};
 for(const rule of rules){
  const conditions=Object.entries(rule.wenn);
  const known=(key:string,value:string|boolean|number)=>Object.hasOwn(facts,key)&&typeof facts[key]===typeof value&&(typeof facts[key]!=='number'||Number.isFinite(facts[key]));
  if(conditions.some(([key,value])=>known(key,value)&&facts[key]!==value))continue;
  const missing=conditions.filter(([key,value])=>!known(key,value)).map(([key])=>key);
  if(missing.length)return {code:'SOURCE_INCOMPLETE' as const,ruleId:rule.id,missing};
  return {code:'OK' as const,ruleId:rule.id,...rule.dann,quelle:{rule:rule.id,source:rule.quelle,sha256:V45_SOURCE_HASHES['regeln.json'],previewSha256:V45_PREVIEW_SHA}};
 }
 return {code:'SOURCE_INCOMPLETE' as const,missing:['MATCHING_V45_RULE']};
}

/** One rights-filtered rule seam for the later U2 domain composition.
 * It never returns caller facts or example amounts, and grants no command right.
 */
export function readAuthorizedV45Rule(auth:AuthorizationSnapshot,area:string,facts:Readonly<Record<string,unknown>>){
 if(!auth.active)return {code:'FORBIDDEN' as const};
 const selected=readV45Rule(area,facts);
 if(selected.code!=='OK')return selected;
 if(selected.hauptaktion===null)return {...selected,gesperrt:[]};
 const metadata=V45_ELEMENTS.filter(row=>row.id===selected.hauptaktion);
 if(metadata.length!==1||!Object.hasOwn(metadata[0],'recht')||typeof metadata[0].text!=='string')return {code:'SOURCE_INCOMPLETE' as const,missing:['ACTION_METADATA']};
 const action=metadata[0],right=action.recht;
 // V45 status names the existing perm_op_status capability; no role inference.
 if(right!==null&&right!=='status'&&!isAccessArea(right))return {code:'SOURCE_INCOMPLETE' as const,missing:['ACTION_RIGHT']};
 const permitted=auth.active&&(right===null||right==='status'?right===null||auth.permissions.includes('perm_op_status'):hasAuthorizationArea(auth,right!));
 if(!permitted)return {...selected,hauptaktion:null,gesperrt:[{elementId:action.id,grundKey:'error.permission'}]};
 return {...selected,textKey:action.text,recht:right,gesperrt:[]};
}
