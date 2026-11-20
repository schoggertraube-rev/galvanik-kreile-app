// @vitest-environment node
// Real existing Replay relation locks only: no fixture reset or product mutation.
import {expect,it} from 'vitest';
import postgres from 'postgres';
import {lockFixtureResetTables,readFixtureResetBlockers} from '../../../e2e/generated/_fixtureReset';

it('observes the real finishing reader and preserves the actual NOWAIT refusal until it releases',async()=>{
 const database=process.env.DATABASE_URL;
 if(!database||database!==process.env.H18_EXPECTED_DATABASE_URL||!['127.0.0.1','localhost'].includes(new URL(database).hostname))throw Error('TEST_EXPLICIT_REPLAY_REQUIRED');
 const holder=postgres(database,{max:1,prepare:false}),observer=postgres(database,{max:1,prepare:false});
 const tables=[{schema:'private',name:'order_freeze_corrections'}];
 let release!:()=>void,acquired!:()=>void,pid=0;
 const releaseReader=new Promise<void>(resolve=>{release=resolve;});
 const readerAcquired=new Promise<void>(resolve=>{acquired=resolve;});
 const holding=holder.begin(async tx=>{
  await tx.unsafe('LOCK TABLE private.order_freeze_corrections IN ACCESS SHARE MODE');
  const [identity]=await tx<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;pid=identity.pid;acquired();
  await releaseReader;
 });
 try{
  await Promise.race([readerAcquired,holding]);
  expect(pid).toBeGreaterThan(0);
  expect(await readFixtureResetBlockers(observer,tables)).toContainEqual({pid});
  await expect(observer.begin(tx=>lockFixtureResetTables(tx,tables))).rejects.toMatchObject({code:'55P03'});
  release();await holding;
  expect(await readFixtureResetBlockers(observer,tables)).not.toContainEqual({pid});
  await observer.begin(tx=>lockFixtureResetTables(tx,tables));
 }finally{
  release();try{await holding;}finally{await Promise.all([holder.end({timeout:3}),observer.end({timeout:3})]);}
 }
});
