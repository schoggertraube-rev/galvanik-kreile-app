// @vitest-environment node
import {strict as assert} from 'node:assert';
import {randomUUID} from 'node:crypto';
import {test,vi} from 'vitest';
import {sql as query} from 'drizzle-orm';

const mandant=vi.hoisted(()=>'TEST-ablauf-h1-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:mandant}));

import {createFixture,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {recordIntakeTaskEffect} from '@/modules/eingang/server-public';
import {readCustomerProfile} from '@/modules/customers/server-public';
import {readLagerBestandsqualifikationInTransaction} from '@/modules/lager/server-public';
import {completeTask,synchronizeLagerBestandTask} from '@/modules/tasks/server-public';

const url=process.env.DATABASE_URL;
const requiredPort=process.env.GITHUB_ACTIONS==='true'?'54322':'54342';
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||new URL(url).port!==requiredPort){
 throw Error('H1_DEDICATED_LOOPBACK_REQUIRED');
}

test('Negativer Eigenbestand erzeugt eine belegte Aufgabe; Ausgleich beendet genau diese',async()=>{
 const actor=await createFixture(['lager.stamm'],'buero');
 const artikelId='TEST-H1-'+randomUUID();
 await sql`INSERT INTO public.inventory_items(id,tenant_id,name,basiseinheit,stamm_status)
  VALUES(${artikelId},${mandant},'TEST Schleifmittel','stk','aktiv')`;
 const [ort]=await sql<{id:string}[]>`INSERT INTO public.stock_locations(tenant_id,stockwerk,bereich)
  VALUES(${mandant},'TEST H1','TEST Regal') RETURNING id::text`;
 assert.ok(ort);
 await withSession(actor,async()=>{
  const session=await resolveAuthorization();assert.ok(session.ok);
  const auth=session.data;
  const effect=(tx:Parameters<typeof recordIntakeTaskEffect>[0],from:typeof auth,input:Parameters<typeof recordIntakeTaskEffect>[2])=>
   recordIntakeTaskEffect(tx,from,input,readCustomerProfile);
  const leseBestand=async(tx:Parameters<typeof readLagerBestandsqualifikationInTransaction>[0])=>{
   const stand=await readLagerBestandsqualifikationInTransaction(tx,mandant,artikelId);
   if(!stand)throw Error('LAGER_BESTAND_ARTIKEL_FEHLT');
   return {artikelId:stand.artikelId,artikelName:stand.name,negativ:stand.negativ,heute:stand.heute};
  };
  const deps={effect,leseBestand};
  const book=async(menge:number)=>withPrivilegedTenantTransaction(auth,async tx=>{
   const befehl=randomUUID();
   const zeile=JSON.stringify([{artikel_id:artikelId,art:menge<0?'stock_out':'stock_in',menge,
    ort_id:ort.id,einheit:'stk',fachzeit:new Date().toISOString(),revision:1,mengenqualitaet:'exakt',
    geschaeftsgrund:menge<0?'entnahme':'wareneingang'}]);
   await tx.execute(query`SELECT * FROM private.lager_journal_anhaengen(
    ${befehl}::uuid,${'a'.repeat(64)},${auth.userId}::uuid,${zeile}::jsonb)`);
  });
  await book(-2);
  await assert.rejects(withPrivilegedTenantTransaction(auth,tx=>synchronizeLagerBestandTask(tx,auth,artikelId,{...deps,effect:async()=>{throw Error('TEST_H1_EFFECT_FAIL');}})),/TEST_H1_EFFECT_FAIL/);
  await assert.rejects(withPrivilegedTenantTransaction(auth,tx=>synchronizeLagerBestandTask(tx,auth,artikelId,{effect,leseBestand:async()=>{throw Error('TEST_H1_READER_FAIL');}})),/TEST_H1_READER_FAIL/);
  await assert.rejects(withPrivilegedTenantTransaction(auth,tx=>synchronizeLagerBestandTask(tx,auth,artikelId,{effect,leseBestand:async tx=>({...await leseBestand(tx),artikelId:'TEST-other'})})),/LAGER_BESTAND_ARTIKEL_ABWEICHUNG/);
  const [before]=await sql<{anzahl:number}[]>`SELECT count(*)::integer AS anzahl FROM public.tasks
   WHERE tenant_id=${mandant} AND bezug_typ='lagerbestand' AND bezug_id=${artikelId}`;
  assert.equal(before.anzahl,0);
  const first=await withPrivilegedTenantTransaction(auth,tx=>synchronizeLagerBestandTask(tx,auth,artikelId,deps));
  assert.ok(first);
  assert.equal(await withPrivilegedTenantTransaction(auth,tx=>synchronizeLagerBestandTask(tx,auth,artikelId,deps)),first);
  const [open]=await sql<{id:string;version:number;titel:string;status:string}[]>`SELECT id::text,version,titel,status
   FROM public.tasks WHERE tenant_id=${mandant} AND bezug_typ='lagerbestand' AND bezug_id=${artikelId}`;
  assert.equal(open.id,first);assert.equal(open.titel,'Bestand von TEST Schleifmittel klären');assert.equal(open.status,'offen');
  assert.equal((await completeTask({taskId:open.id,version:open.version,note:null},{effect})).code,'FORBIDDEN');
  await book(2);
  assert.equal(await withPrivilegedTenantTransaction(auth,tx=>synchronizeLagerBestandTask(tx,auth,artikelId,deps)),first);
  const [closed]=await sql<{status:string;version:number}[]>`SELECT status,version FROM public.tasks WHERE id=${first}::uuid`;
  assert.equal(closed.status,'erledigt');assert.equal(closed.version,open.version+1);
  assert.equal(await withPrivilegedTenantTransaction(auth,tx=>synchronizeLagerBestandTask(tx,auth,artikelId,deps)),null);
  const [count]=await sql<{anzahl:number}[]>`SELECT count(*)::integer AS anzahl FROM public.tasks
   WHERE tenant_id=${mandant} AND bezug_typ='lagerbestand' AND bezug_id=${artikelId}`;
  assert.equal(count.anzahl,1);
  assert.equal((await withPrivilegedTenantTransaction(auth,tx=>readLagerBestandsqualifikationInTransaction(tx,mandant,artikelId)))?.negativ,false);
 });
});
