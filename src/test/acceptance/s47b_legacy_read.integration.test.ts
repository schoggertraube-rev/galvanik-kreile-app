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
   await tx`CREATE TEMP TABLE invoices(snapshot jsonb) ON COMMIT DROP`;
   await tx`SET LOCAL search_path TO pg_temp,public`;
   const check=async()=>Object.fromEntries((await tx.unsafe(query)).flat().map(row=>[row.pruefung,{anzahl:Number(row.anzahl),treffer:row.treffer}]));
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
   try{
    const rows=await tx.savepoint(async scoped=>(await scoped.unsafe(query)).flat());
    expect(rows).toHaveLength(2);
    for(const row of rows)expect(Number(row.anzahl)).toBe(row.treffer.length);
    return rows;
   }catch(error){
    // PL14:03 intentionally stops the complete live check when this TEST DB
    // still contains pre-live originals. No old predicate/assertion is removed.
    const failure=error as {code?:string;message?:string};
    const blocked=/^LIVEGANG_STOP_RECHNUNGEN_VOR_V3: ([0-9]+)$/.exec(failure.message??'');
    if(!blocked)throw error;
    expect(failure.code).toBe('P0001');expect(Number(blocked[1])).toBeGreaterThan(0);
    return [{pruefung:'invoices_snapshot_before_v3_livegang_stopp',anzahl:Number(blocked[1]),treffer:[]}];
   }
  });
  writeFileSync('.git/kreile-s47b-altbestand-public-read.json',JSON.stringify({at:new Date().toISOString(),loopback:new URL(database).host,readOnly:true,searchPath:'public',syntheticFixturesRolledBack:true,findings:actual},null,2));
 }finally{await sql.end({timeout:5});}
});

it('S54o A16 runs the complete live gate: current originals pass, old or unknown versions stop with a count only',async()=>{
 const sql=postgres(database,{max:1,prepare:false});
 try{
  await expect(sql.begin(async tx=>{
   await tx`CREATE TEMP TABLE orders(id text,tenant_id text,status text,station text) ON COMMIT DROP`;
   await tx`CREATE TEMP TABLE complaints(id text,tenant_id text,stand text) ON COMMIT DROP`;
   await tx`CREATE TEMP TABLE invoices(snapshot jsonb) ON COMMIT DROP`;
   await tx`SET LOCAL search_path TO pg_temp,public`;
   expect((await tx.unsafe(query)).flat()).toHaveLength(2);
   await tx`INSERT INTO invoices(snapshot) VALUES ('{"schemaVersion":3}'::jsonb)`;
   expect((await tx.unsafe(query)).flat()).toHaveLength(2);
   for(const fixtures of [[{schemaVersion:1}],[{schemaVersion:2}],[null],[{}],[{schemaVersion:'3'}],[{schemaVersion:1},{schemaVersion:2},null]]){
    await expect(tx.savepoint(async scoped=>{
     await scoped`INSERT INTO invoices(snapshot) SELECT value FROM jsonb_array_elements(${scoped.json(fixtures)})`;
     await scoped.unsafe(query);
    })).rejects.toMatchObject({code:'P0001',message:'LIVEGANG_STOP_RECHNUNGEN_VOR_V3: '+fixtures.length});
    expect(await tx`SELECT count(*)::integer AS count FROM invoices`).toEqual([{count:1}]);
   }
   throw Error('TEST_S54O_LIVE_GATE_ROLLBACK');
  })).rejects.toThrow('TEST_S54O_LIVE_GATE_ROLLBACK');
 }finally{await sql.end({timeout:5});}
});
