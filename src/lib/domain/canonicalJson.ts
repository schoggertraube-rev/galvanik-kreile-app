/** JSON/JSONB-safe intent equality: object order is irrelevant; array order is preserved. */
export function canonicalJson(value:unknown):string {
 return JSON.stringify(value,(_key,entry:unknown)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a.localeCompare(b))):entry);
}
