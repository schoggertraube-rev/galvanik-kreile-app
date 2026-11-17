import type {ProtocolSettings} from './public';

/** One validator for persisted settings and the existing company settings command. */
export function parseProtocolSettings(input:unknown):ProtocolSettings|null{
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const row=input as Record<string,unknown>;
 if(Object.keys(row).sort().join('|')!=='hangMs|retentionDays|slowMs')return null;
 const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&value<=2147483647;
 if(row.retentionDays!==null&&!positive(row.retentionDays)||!positive(row.slowMs)||!positive(row.hangMs))return null;
 return {retentionDays:row.retentionDays as number|null,slowMs:row.slowMs,hangMs:row.hangMs};
}
