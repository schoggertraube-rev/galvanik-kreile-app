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
