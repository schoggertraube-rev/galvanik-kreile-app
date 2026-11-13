// @vitest-environment node
// TEST provider-header and stored-clock fixtures; native request/Auth/action/DB are real.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {loginWithPin} from '@/app/actions/auth.actions';
import {createPinLoginHandle} from '@/lib/server/pinLoginHandle';

it('S05K A6 counts unknown handles on the trusted salted IP, serializes 50, and prunes old windows',async()=>{
 const original=process.env.VERCEL;
 process.env.VERCEL='1';
 const headers={'x-vercel-forwarded-for':'198.51.100.6, 203.0.113.9','x-forwarded-for':'203.0.113.99'};
 const attempt=()=>withSession(full,()=>loginWithPin(createPinLoginHandle(randomUUID()),'1111'),false,headers);
 try{
  await sql`INSERT INTO private.pin_ip_rate_limits(tenant_id,ip_hash,window_start,failed_attempts) VALUES(${tenant},${'0'.repeat(64)},to_timestamp(floor(extract(epoch FROM statement_timestamp())/3600)*3600)-interval '25 hours',1)`;
  for(let index=0;index<49;index++)expect(await attempt()).toMatchObject({ok:false,message:'Code falsch · bitte neu eingeben'});
  const simultaneous=await Promise.all(Array.from({length:6},attempt));
  expect(simultaneous).toHaveLength(6);
  for(const result of simultaneous)expect(result).toMatchObject({ok:false,message:expect.stringMatching(/^Zu viele Versuche\. Versuch es um \d{2}:\d{2} wieder\.$/)});
  const counters=await sql`SELECT ip_hash,failed_attempts,window_start FROM private.pin_ip_rate_limits WHERE tenant_id=${tenant}`;
  expect(counters).toHaveLength(1);
  expect(counters[0].failed_attempts).toBe(50);
  expect(counters[0].ip_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(counters[0].ip_hash).not.toContain('198.51.100.6');
  const [operators]=await sql`SELECT count(*)::integer AS n FROM public.pin_rate_limits WHERE tenant_id=${tenant}`;
  expect(operators.n).toBe(0);
  // A different authoritative IP has its own budget; client x-forwarded-for has no authority.
  expect(await withSession(full,()=>loginWithPin(createPinLoginHandle(randomUUID()),'1111'),false,{'x-real-ip':'203.0.113.10','x-forwarded-for':'198.51.100.6'})).toMatchObject({ok:false,message:'Code falsch · bitte neu eingeben'});
  const reread=await sql`SELECT failed_attempts FROM private.pin_ip_rate_limits WHERE tenant_id=${tenant} ORDER BY failed_attempts`;
  expect(reread.map(row=>row.failed_attempts)).toEqual([1,50]);
 }finally{if(original===undefined)delete process.env.VERCEL;else process.env.VERCEL=original;}
});
