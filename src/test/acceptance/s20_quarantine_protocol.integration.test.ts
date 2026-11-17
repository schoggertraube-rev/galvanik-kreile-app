// @vitest-environment node
// Synthetic TEST originals; actual existing capture/Storage/Auth/DB writers, not browser proof.
import {createHash,randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {saveIntakeNoteAction,getIntakeCaptureAction,prepareIntakeFileAction,finishIntakeFileAction} from '@/app/actions/eingang.actions';
import {uploadIntakeOriginal} from '@/modules/eingang/public';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');
beforeAll(async()=>{await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST S20 quarantine protocol')`;});

it('L11 adopted note logs only the committed takeover source and its persisted device time; fresh retry never copies private bytes into diagnostics',async()=>{
 const text='TEST PRIVATE_QUARANTINE_TEXT',originalRecord=JSON.stringify({text}),deviceCapturedAt=new Date(Date.now()-180000).toISOString();
 const takeover={sourceId:'quarantine:TEST-'+randomUUID(),deviceId:randomUUID(),originalRecord,sha256:createHash('sha256').update(originalRecord).digest('hex')};
 const input={itemId:randomUUID(),textstand:randomUUID(),text,concerns:[],deviceCapturedAt,takeover};
 const saved=await withSession(full,()=>saveIntakeNoteAction(input));
 expect(saved).toMatchObject({code:'OK',capture:{id:input.itemId,takeovers:[{deviceCapturedAt,actorId:full.actorId}]}});
 const rows=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='offline_quarantine' AND subject_id=${input.itemId}`;
 expect(rows).toHaveLength(1);expect(rows[0].user_id).toBe(full.actorId);expect(new Date(rows[0].occurred_at).toISOString()).toBe(deviceCapturedAt);
 expect(JSON.stringify(rows)).not.toContain('PRIVATE_QUARANTINE_TEXT');
 expect(await withSession(full,()=>saveIntakeNoteAction(JSON.parse(JSON.stringify(input))))).toEqual(saved);
 expect(await withSession(full,()=>getIntakeCaptureAction(input.itemId))).toEqual(saved);
 expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND nachher->>'action'='original_adopted'`).toHaveLength(1);
 const before=await sql`SELECT count(*)::int AS n FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='offline_quarantine' AND subject_id=${input.itemId}`;
 expect(await withSession(full,()=>saveIntakeNoteAction({...input,deviceCapturedAt:new Date().toISOString()}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::int AS n FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='offline_quarantine' AND subject_id=${input.itemId}`).toEqual(before);
 expect(await withSession(full,()=>saveIntakeNoteAction({itemId:input.itemId,textstand:randomUUID(),text:'TEST later ordinary note',concerns:[]}))).toMatchObject({code:'OK'});
 expect(await sql`SELECT count(*)::int AS n FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='offline_quarantine' AND subject_id=${input.itemId}`).toEqual(before);
});

it('L11 file takeover is recorded only after actual immutable Storage confirmation, never merely after an upload grant',async()=>{
 const file=new File(['TEST PRIVATE_QUARANTINE_BYTES'],'TEST-original.txt',{type:'text/plain'}),deviceId=randomUUID(),deviceCapturedAt=new Date(Date.now()-120000).toISOString();
 const originalRecord=JSON.stringify({name:file.name,mime:file.type,bytes:file.size});
 const input={itemId:randomUUID(),fileId:randomUUID(),name:file.name,mime:file.type,bytes:file.size,sha256:createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex'),deviceId,deviceCapturedAt,takeover:{sourceId:'quarantine:TEST-'+randomUUID(),deviceId,originalRecord,sha256:createHash('sha256').update(originalRecord).digest('hex')}};
 const denied=await createFixture(['auftraege']);
 expect(await withSession(denied,()=>prepareIntakeFileAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(denied,()=>finishIntakeFileAction(input.fileId))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT command,reason,subject_id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${denied.actorId}::uuid AND event_type='rejected' ORDER BY command`).toEqual([
  {command:'finishIntakeFileAction',reason:'FORBIDDEN',subject_id:input.fileId},
  {command:'prepareIntakeFileAction',reason:'FORBIDDEN',subject_id:input.itemId}
 ]);
 const prepared=await withSession(full,()=>prepareIntakeFileAction(input));if(prepared.code!=='OK'||!prepared.upload)throw Error('TEST_REAL_STORAGE_GRANT_REQUIRED');
 expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='offline_quarantine' AND subject_id=${input.itemId}`).toHaveLength(0);
 await uploadIntakeOriginal(prepared.upload,file);
 const saved=await withSession(full,()=>finishIntakeFileAction(input.fileId));
 expect(saved).toMatchObject({code:'OK',capture:{files:[{id:input.fileId,secured:true}],takeovers:[{deviceCapturedAt}]}});
 const [stored]=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='offline_quarantine' AND subject_id=${input.itemId}`;
 expect(stored.user_id).toBe(full.actorId);expect(new Date(stored.occurred_at).toISOString()).toBe(deviceCapturedAt);expect(JSON.stringify(stored)).not.toContain('PRIVATE_QUARANTINE_BYTES');
 expect(await withSession(full,()=>finishIntakeFileAction(input.fileId))).toEqual(saved);
});
