// @vitest-environment node
// Native Loopback PostgreSQL; read-only TEST probes, no source/provider doubles.
import {afterAll,expect,it} from 'vitest';
import postgres from 'postgres';
import {PageReadTimeout,withPageReadBudget,withPageReadQueryLimits} from '@/db/readBudget';

const url=process.env.DATABASE_URL;
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||new URL(url).port!=='54342')throw Error('TEST_OWN_LOOPBACK_REQUIRED');
const configured:number[]=[];
const native=postgres(url,{prepare:false,max:1,debug:(_connection,text,parameters)=>{
 if(text.includes("set_config('statement_timeout'"))configured.push(Number(parameters[0]));
}});
const client=withPageReadQueryLimits(native);
afterAll(()=>native.end({timeout:5}));

it('sets one native timeout for four fast statements and refreshes it only after 250ms',async()=>{
 await client`SELECT 1`;configured.length=0;
 await withPageReadBudget(()=>client.begin(async tx=>{
  for(let index=0;index<4;index++)expect(await tx`SELECT ${index}::integer AS n`).toMatchObject([{n:index}]);
  expect(configured).toHaveLength(1);
  await tx.savepoint(async nested=>{expect(await nested`SELECT 5 AS n`).toMatchObject([{n:5}]);});
  expect(configured).toHaveLength(1);
  await new Promise(resolve=>setTimeout(resolve,300));
  expect(await tx`SELECT 6 AS n`).toMatchObject([{n:6}]);
  expect(configured).toHaveLength(2);expect(configured[1]).toBeLessThan(configured[0]);
 }),2000);
});

it('still cancels a real slow query at its page deadline and returns the native connection intact',async()=>{
 await client`SELECT 1`;configured.length=0;
 const failure=await withPageReadBudget(()=>client.begin(async tx=>{
  await tx`SELECT pg_sleep(1)`;
 }),100).then(()=>null,error=>error);
 expect(failure).toBeInstanceOf(PageReadTimeout);
 expect(configured).toHaveLength(1);
 expect(await withPageReadBudget(()=>client.begin(tx=>tx`SELECT 7 AS n`),1000)).toMatchObject([{n:7}]);
});
