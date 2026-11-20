// @vitest-environment node
import {afterAll,expect,it} from 'vitest';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
import {sql} from 'drizzle-orm';
import {PageReadTimeout,withPageReadBudget,withPageReadQueryLimits} from '@/db/readBudget';

const url=process.env.DATABASE_URL;
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_LOOPBACK_REPLAY_REQUIRED');
const native=postgres(url,{prepare:false,max:1});
const client=withPageReadQueryLimits(native);
const db=drizzle(client);
afterAll(()=>native.end({timeout:5}));

it('cancels a real active query and frees the existing connection for the next read',async()=>{
  await db.execute(sql`SELECT 1`);
  const started=Date.now();
  await expect(withPageReadBudget(()=>db.execute(sql`SELECT pg_sleep(1)`),100)).rejects.toMatchObject({cause:expect.any(PageReadTimeout)});
  expect(Date.now()-started).toBeLessThan(800);
  expect(await withPageReadBudget(()=>db.execute<{ok:number}>(sql`SELECT 1 AS ok`),1000)).toMatchObject([{ok:1}]);
});

it('cancels a queued read without cancelling a different request or altering unscoped commands',async()=>{
  const outside=db.execute<{ok:number}>(sql`SELECT 2 AS ok, pg_sleep(0.3)`);
  const active=Promise.resolve(outside);
  // Queue order is deterministic: the unscoped query reserves the sole connection first.
  await new Promise(resolve=>setTimeout(resolve,25));
  await expect(withPageReadBudget(()=>db.execute(sql`SELECT 3`),50)).rejects.toMatchObject({cause:expect.any(PageReadTimeout)});
  expect(await active).toMatchObject([{ok:2}]);
  expect(await db.execute<{ok:number}>(sql`SELECT 4 AS ok`)).toMatchObject([{ok:4}]);
});

it('bounds native nested transactions, rolls back timed-out reads and retains a usable pool',async()=>{
  await expect(withPageReadBudget(()=>db.transaction(tx=>tx.transaction(nested=>nested.execute(sql`SELECT pg_sleep(1)`))),100)).rejects.toMatchObject({cause:expect.any(PageReadTimeout)});
  expect(await withPageReadBudget(()=>db.transaction(tx=>tx.execute<{ok:number}>(sql`SELECT 5 AS ok`)),1000)).toMatchObject([{ok:5}]);
});

it('rejects an already expired read without executing it or leaving an unobserved cancellation',async()=>{
 await expect(withPageReadBudget(async()=>{
  await new Promise(resolve=>setTimeout(resolve,30));
  return db.execute(sql`SELECT pg_sleep(1)`);
 },10)).rejects.toMatchObject({cause:expect.any(PageReadTimeout)});
 expect(await db.execute<{ok:number}>(sql`SELECT 6 AS ok`)).toMatchObject([{ok:6}]);
});
