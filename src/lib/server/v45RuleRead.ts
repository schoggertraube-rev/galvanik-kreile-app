import 'server-only';
import {V45_RULES,V45_SOURCE_HASHES,V45_PREVIEW_SHA} from '@/ui/v45.generated';

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
