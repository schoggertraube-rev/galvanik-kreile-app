// @vitest-environment node
// Actual capture Action/Auth/DB rollback and retry. Fault injection is isolated to this TEST tenant.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {saveIntakeNoteAction,getIntakeCaptureAction} from '@/app/actions/eingang.actions';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');

it('a real capture SQL fault logs the existing constant identifier after rollback, never input/error contents; the original request retries and rereads once',async()=>{
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST S20 deferred capture')`;
 const input={itemId:randomUUID(),textstand:randomUUID(),text:'TEST PRIVATE_CAPTURE PIN 1234 Bearer x',concerns:[]};
 const fault='test_s20_capture_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.item_id='${input.itemId}'::uuid AND NEW.art='original_gespeichert' THEN RAISE EXCEPTION 'TEST PRIVATE_SQL_CONTENT'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>saveIntakeNoteAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.itemId}::uuid`).toHaveLength(0);
  const stored=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='server_error' AND subject_id=${input.itemId}`;
  expect(stored).toHaveLength(1);expect(stored[0]).toMatchObject({command:'INTAKE_NOTE_WRITE_FAILED',user_id:full.actorId,reason:'UNKNOWN'});
  for(const secret of ['PRIVATE_CAPTURE','1234','Bearer x','PRIVATE_SQL_CONTENT'])expect(JSON.stringify(stored)).not.toContain(secret);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.intake_event`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const saved=await withSession(full,()=>saveIntakeNoteAction(JSON.parse(JSON.stringify(input))));
 expect(saved).toMatchObject({code:'OK',capture:{id:input.itemId,text:input.text}});
 expect(await withSession(full,()=>saveIntakeNoteAction(JSON.parse(JSON.stringify(input))))).toEqual(saved);
 expect(await withSession(full,()=>getIntakeCaptureAction(input.itemId))).toEqual(saved);
 expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND art='original_gespeichert' AND befehl_id=${input.textstand}::uuid`).toHaveLength(1);
});
