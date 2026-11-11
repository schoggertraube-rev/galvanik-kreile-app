import 'server-only';
import {V45_RUNTIME} from '@/ui/v45.generated';

/** Return only the placeholders required by the existing text key. This reader
 * neither invents missing values nor copies example content from the preview. */
export function readV45ActionValues(textKey:string,available:Readonly<Record<string,unknown>>){
 const template=V45_RUNTIME.texte[textKey]?.text;
 if(typeof template!=='string')return {code:'SOURCE_INCOMPLETE' as const,missing:['ACTION_TEXT']};
 const keys=[...new Set([...template.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(match=>match[1]))];
 const valid=(value:unknown):value is string|number=>typeof value==='string'?value.trim().length>0:typeof value==='number'&&Number.isFinite(value);
 const missing=keys.filter(key=>!Object.hasOwn(available,key)||!valid(available[key]));
 if(missing.length)return {code:'SOURCE_INCOMPLETE' as const,missing};
 return {code:'OK' as const,werte:Object.fromEntries(keys.map(key=>[key,available[key] as string|number]))};
}
