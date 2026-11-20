export type PageReadSettings={queryTimeoutMs:number;invoiceMailBatchLimit:number};
export const DEFAULT_PAGE_READ_SETTINGS:Readonly<PageReadSettings>={queryTimeoutMs:10_000,invoiceMailBatchLimit:101};
export function parsePageReadSettings(value:unknown):PageReadSettings|null{
  if(value===null||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  if(Object.keys(row).sort().join(',')!=='invoiceMailBatchLimit,queryTimeoutMs')return null;
  if(!Number.isSafeInteger(row.queryTimeoutMs)||Number(row.queryTimeoutMs)<1||Number(row.queryTimeoutMs)>2147483647
    ||!Number.isSafeInteger(row.invoiceMailBatchLimit)||Number(row.invoiceMailBatchLimit)<1||Number(row.invoiceMailBatchLimit)>2147483647)return null;
  return {queryTimeoutMs:Number(row.queryTimeoutMs),invoiceMailBatchLimit:Number(row.invoiceMailBatchLimit)};
}


/** Only the positively identified pre-migration schema uses the approved
 * defaults. Present but null/invalid/partially deployed settings stay unknown. */
export function pageReadSettingsFromCompany(value:unknown):{settings:PageReadSettings;schemaReady:boolean}|null{
 if(value===null||typeof value!=='object'||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 if(row.hasQueryTimeout===false&&row.hasInvoiceBatchLimit===false)
  return {settings:{...DEFAULT_PAGE_READ_SETTINGS},schemaReady:false};
 if(row.hasQueryTimeout!==true||row.hasInvoiceBatchLimit!==true)return null;
 const settings=parsePageReadSettings({queryTimeoutMs:row.queryTimeoutMs,invoiceMailBatchLimit:row.invoiceMailBatchLimit});
 return settings?{settings,schemaReady:true}:null;
}
