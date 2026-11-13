// @vitest-environment node
// Explicitly synthetic TEST-only tables. Never imports the destructive default-port harness.
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {expect,it} from 'vitest';
import {lockFixtureResetTables,fixtureResetTargets,retryFixtureResetDeadlock} from '../../e2e/generated/_fixtureReset';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl||databaseUrl!==process.env.H18_EXPECTED_DATABASE_URL)throw Error('TEST_RESET_EXPECTED_DATABASE_URL_REQUIRED');
const endpoint=new URL(databaseUrl);
if(endpoint.hostname!=='127.0.0.1'||endpoint.pathname!=='/postgres')throw Error('TEST_RESET_LOOPBACK_REQUIRED');

it('resets twenty times while a real reverse-order SQL read is in flight, without deadlocks or touching product rows',async()=>{
 const writer=postgres(databaseUrl,{max:1,prepare:false}),reader=postgres(databaseUrl,{max:1,prepare:false});
 const prefix='test_fixture_reset_'+randomUUID().replaceAll('-','').slice(0,16);
 const parent=prefix+'_a',child=prefix+'_b';
 const tables=[{schema:'public',name:child},{schema:'public',name:parent}];
 const targets=fixtureResetTargets(tables);
 const retries:Array<{attempt:number;code:string}>=[];
 const baseline=await writer`SELECT (SELECT count(*)::text FROM public.invoices) AS invoices,(SELECT count(*)::text FROM public.customer_credit_entries) AS credits`;
 try{
  await writer.unsafe(`CREATE TABLE public."${parent}"(id integer PRIMARY KEY,marker text NOT NULL CHECK(marker LIKE 'TEST-%'))`);
  await writer.unsafe(`CREATE TABLE public."${child}"(id integer PRIMARY KEY,parent_id integer NOT NULL REFERENCES public."${parent}"(id),marker text NOT NULL CHECK(marker LIKE 'TEST-%'))`);
  for(let run=0;run<20;run++){
   await writer.unsafe(`INSERT INTO public."${parent}" VALUES(1,'TEST-parent')`);
   await writer.unsafe(`INSERT INTO public."${child}" VALUES(1,1,'TEST-child')`);
   let started!:()=>void;
   const firstRead=new Promise<void>(resolve=>{started=resolve;});
   const inFlight=reader.begin(async query=>{
    expect(await query.unsafe(`SELECT marker FROM public."${child}" WHERE id=1`)).toEqual([{marker:'TEST-child'}]);
    started();
    await query`SELECT pg_sleep(0.02)`;
    expect(await query.unsafe(`SELECT marker FROM public."${parent}" WHERE id=1`)).toEqual([{marker:'TEST-parent'}]);
   });
   await firstRead;
   await retryFixtureResetDeadlock(()=>writer.begin(async cleanup=>{
    await lockFixtureResetTables(cleanup,tables);
    await cleanup.unsafe(`TRUNCATE TABLE ${targets} CASCADE`);
   }),(_label,detail)=>{retries.push(detail as {attempt:number;code:string});});
   await inFlight;
   expect(await writer.unsafe(`SELECT (SELECT count(*)::int FROM public."${parent}") AS parents,(SELECT count(*)::int FROM public."${child}") AS children`)).toEqual([{parents:0,children:0}]);
  }
  expect(retries.some(retry=>retry.code==='40P01')).toBe(false);
  expect(retries.every(retry=>retry.code==='55P03'&&retry.attempt<=2)).toBe(true);
  expect(await writer`SELECT (SELECT count(*)::text FROM public.invoices) AS invoices,(SELECT count(*)::text FROM public.customer_credit_entries) AS credits`).toEqual(baseline);
 }finally{
  await writer.unsafe(`DROP TABLE IF EXISTS public."${child}"`);
  await writer.unsafe(`DROP TABLE IF EXISTS public."${parent}"`);
  await reader.end({timeout:5});await writer.end({timeout:5});
 }
});
