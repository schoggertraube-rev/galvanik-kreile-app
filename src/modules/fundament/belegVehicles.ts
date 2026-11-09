export type BelegVehicle={id:string;label:string;active:boolean};
/** Shared input contract; never manufactures choices or drops inactive history. */
export function parseBelegVehicles(value:unknown):BelegVehicle[]|null{
 if(!Array.isArray(value)||value.length>200)return null;
 const seen=new Set<string>(),result:BelegVehicle[]=[];
 for(const row of value){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join(',')!=='active,id,label'
   ||typeof row.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id)
   ||typeof row.label!=='string'||!row.label.trim()||row.label.trim().length>120||/[\u0000-\u001f]/.test(row.label)||typeof row.active!=='boolean'||seen.has(row.id))return null;
  seen.add(row.id);result.push({id:row.id,label:row.label.trim(),active:row.active});
 }
 return result.sort((a,b)=>a.id.localeCompare(b.id));
}
