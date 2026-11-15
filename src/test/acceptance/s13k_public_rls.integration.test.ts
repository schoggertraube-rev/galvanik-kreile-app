// @vitest-environment node
import {it,expect} from 'vitest';
import postgres from 'postgres';
const connection=process.env.DATABASE_URL;
if(!connection||connection!==process.env.H18_EXPECTED_DATABASE_URL||!['127.0.0.1','localhost'].includes(new URL(connection).hostname)||new URL(connection).pathname!=='/postgres')throw Error('OWN_LOOPBACK_REQUIRED');

it('K13K-1 protects every public table and refuses direct client reads while retaining server access',async()=>{
 const sql=postgres(connection,{max:1,prepare:false});
 try{
  const unprotected=await sql`SELECT relname FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace
   WHERE nspname='public' AND relkind IN ('r','p') AND NOT relrowsecurity ORDER BY relname`;
  expect(unprotected).toEqual([]);
  const targets=['aktion','attribution','einwilligung','feedback_eingang','feedback_mail','forecast_version','inventory_items','kampagne','kanal','kosten_posten','kostensatz_default','kostenstelle','kostenstellen_energie_monat','lern_metrik','marketing_asset','marketing_touchpoints','periode','price_agreements','segment','statistik_kennzahl','teile_klassifikator','telemetrie_event','touchpoint','vorlage_verbrauch','vorlage_zeit','warning_event'];
  const grants=await sql`SELECT table_name,grantee,privilege_type FROM information_schema.table_privileges
   WHERE table_schema='public' AND table_name=ANY(${targets}::text[]) AND grantee IN ('anon','authenticated','PUBLIC')`;
  expect(grants).toEqual([]);
  for(const role of ['anon','authenticated']){
   await expect(sql.begin(async tx=>{
    await tx.unsafe('SET LOCAL ROLE '+role);
    await tx`SELECT 1 FROM public.inventory_items LIMIT 0`;
   })).rejects.toMatchObject({code:'42501'});
  }
  await expect(sql.begin(async tx=>{
   await tx.unsafe('SET LOCAL ROLE service_role');
   return tx`SELECT 1 FROM public.inventory_items LIMIT 0`;
  })).resolves.toEqual([]);
 }finally{await sql.end({timeout:5});}
});
