// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {saveIntakeNoteAction,getIntakeCaptureAction,prepareIntakeFileAction,finishIntakeFileAction} from '@/app/actions/eingang.actions';
import {uploadIntakeOriginal} from '@/modules/eingang/public';
it('qualifies an explicitly adopted original through the existing note writer, with real actor, rollback and retry',async()=>{
 const text='TEST actual quarantined original',originalRecord=JSON.stringify({text}),takeover={sourceId:'quarantine:string:'+JSON.stringify(randomUUID()),deviceId:randomUUID(),originalRecord,sha256:createHash('sha256').update(originalRecord).digest('hex')};
 const input={itemId:randomUUID(),textstand:randomUUID(),text,concerns:[],takeover,deviceCapturedAt:new Date().toISOString()};
 const denied=await createFixture(['auftraege'],'werkstatt');
 expect(await withSession(denied,()=>saveIntakeNoteAction(input))).toMatchObject({code:'FORBIDDEN'});
 const trigger='test_takeover_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.nachher->>'action'='original_adopted' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION private.${trigger}()`);
 try{
  expect(await withSession(full,()=>saveIntakeNoteAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.itemId}::uuid`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${trigger} ON public.intake_event`);await sql.unsafe(`DROP FUNCTION private.${trigger}()`);}
 const saved=await withSession(full,()=>saveIntakeNoteAction(JSON.parse(JSON.stringify(input))));
 expect(saved).toMatchObject({code:'OK',capture:{id:input.itemId,text,takeovers:[{...takeover,actorId:full.actorId}]}});
 expect(await withSession(full,()=>saveIntakeNoteAction(JSON.parse(JSON.stringify(input))))).toEqual(saved);
 expect(await withSession(full,()=>getIntakeCaptureAction(input.itemId))).toEqual(saved);
 expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND nachher->>'action'='original_adopted'`).toHaveLength(1);
 const other=await createFixture(['eingang'],'buero');
 expect(await withSession(other,()=>saveIntakeNoteAction(input))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>saveIntakeNoteAction({...input,takeover:{...takeover,sha256:'f'.repeat(64)}}))).toMatchObject({code:'VALIDATION_ERROR'});
 const changedRecord=JSON.stringify({text:'TEST changed original'});
 expect(await withSession(full,()=>saveIntakeNoteAction({...input,takeover:{...takeover,originalRecord:changedRecord,sha256:createHash('sha256').update(changedRecord).digest('hex')}}))).toMatchObject({code:'CONFLICT'});
});
it('file takeover requires Eingang and is projected only after the actual immutable file is secured',async()=>{
 const file=new File(['TEST immutable takeover bytes'],'TEST-original.txt',{type:'text/plain'}),sha256=createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex'),deviceId=randomUUID();
 const originalRecord=JSON.stringify({name:file.name,mime:file.type,bytes:file.size});
 const input={itemId:randomUUID(),fileId:randomUUID(),name:file.name,mime:file.type,bytes:file.size,sha256,deviceId,deviceCapturedAt:new Date().toISOString(),takeover:{sourceId:'quarantine:TEST-file-'+randomUUID(),deviceId,originalRecord,sha256:createHash('sha256').update(originalRecord).digest('hex')}};
 const money=await createFixture(['geld'],'buero');
 expect(await withSession(money,()=>prepareIntakeFileAction(input))).toMatchObject({code:'FORBIDDEN'});
 const prepared=await withSession(full,()=>prepareIntakeFileAction(input));if(prepared.code!=='OK'||!prepared.upload)throw Error('TEST_REAL_FILE_GRANT');
 const before=await withSession(full,()=>getIntakeCaptureAction(input.itemId));expect(before).toMatchObject({code:'OK'});if(before.code==='OK')expect(before.capture.takeovers).toBeUndefined();
 await uploadIntakeOriginal(prepared.upload,file);
 const secured=await withSession(full,()=>finishIntakeFileAction(input.fileId));
 expect(secured).toMatchObject({code:'OK',capture:{files:[{id:input.fileId,secured:true}],takeovers:[{...input.takeover,actorId:full.actorId}]}});
 expect(await withSession(full,()=>prepareIntakeFileAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>finishIntakeFileAction(input.fileId))).toEqual(secured);
 expect(await withSession(full,()=>getIntakeCaptureAction(input.itemId))).toEqual(secured);
 expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${input.itemId}::uuid AND nachher->>'action'='offline_original_captured'`).toHaveLength(1);
});
