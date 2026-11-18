// @vitest-environment node
// Explicit synthetic legacy rows in rollback-only TEMP tables, never public data.
import {it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import postgres from 'postgres';
const database=process.env.DATABASE_URL;
if(!database||database!==process.env.H18_EXPECTED_DATABASE_URL||new URL(database).hostname!=='127.0.0.1')throw Error('S47B_OWN_LOOPBACK_REQUIRED');
const query=readFileSync('scripts/golive/altbestand_pruefen.sql','utf8');

it('S47b 7 finds zero/one/many synthetic legacy rows without changing public guards and records a separate real read',async()=>{
 const sql=postgres(database,{max:1,prepare:false});
 try{
  await expect(sql.begin(async tx=>{
   await tx`CREATE TEMP TABLE orders(id text,tenant_id text,status text,station text) ON COMMIT DROP`;
   await tx`CREATE TEMP TABLE complaints(id text,tenant_id text,stand text) ON COMMIT DROP`;
   await tx`SET LOCAL search_path TO pg_temp,public`;
   const check=async()=>Object.fromEntries((await tx.unsafe(query)).map(row=>[row.pruefung,{anzahl:Number(row.anzahl),treffer:row.treffer}]));
   expect(await check()).toEqual({orders_legacy_station:{anzahl:0,treffer:[]},complaints_stand_null:{anzahl:0,treffer:[]}});
   await tx`INSERT INTO orders VALUES('TEST-legacy-both','TEST-s47b','in_progress','wareneingang'),('TEST-valid','TEST-s47b','angenommen','angenommen')`;
   await tx`INSERT INTO complaints VALUES('TEST-legacy-null','TEST-s47b',NULL),('TEST-valid','TEST-s47b','offen')`;
   expect(await check()).toEqual({orders_legacy_station:{anzahl:1,treffer:[{id:'TEST-legacy-both',tenant_id:'TEST-s47b',status:'in_progress',station:'wareneingang'}]},complaints_stand_null:{anzahl:1,treffer:[{id:'TEST-legacy-null',tenant_id:'TEST-s47b'}]}});
   await tx`INSERT INTO orders VALUES('TEST-legacy-status','TEST-s47b','completed','fertig'),('TEST-legacy-station','TEST-s47b','abgeholt','versendet')`;
   const many=await check();
   expect(many.orders_legacy_station.anzahl).toBe(3);
   expect(many.orders_legacy_station.treffer.map((row:{id:string})=>row.id)).toEqual(['TEST-legacy-both','TEST-legacy-station','TEST-legacy-status']);
   throw Error('TEST_S47B_ROLLBACK');
  })).rejects.toThrow('TEST_S47B_ROLLBACK');
  const actual=await sql.begin(async tx=>{
   await tx`SET TRANSACTION READ ONLY`;
   await tx`SET LOCAL search_path TO public`;
   expect(await tx`SELECT to_regclass('pg_temp.orders') IS NULL AS no_temp_orders,to_regclass('pg_temp.complaints') IS NULL AS no_temp_complaints`).toEqual([{no_temp_orders:true,no_temp_complaints:true}]);
   const rows=await tx.unsafe(query);
   expect(rows).toHaveLength(2);
   for(const row of rows)expect(Number(row.anzahl)).toBe(row.treffer.length);
   return rows;
  });
  writeFileSync('.git/kreile-s47b-altbestand-public-read.json',JSON.stringify({at:new Date().toISOString(),loopback:new URL(database).host,readOnly:true,searchPath:'public',syntheticFixturesRolledBack:true,findings:actual},null,2));
 }finally{await sql.end({timeout:5});}
});
