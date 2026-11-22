// @vitest-environment node
// Explicit synthetic migration fixtures in one rolled-back transaction on the real TEST replay.
// The actual migration SQL is executed; no right resolver, guard, table or receipt is doubled.
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {expect,it} from 'vitest';

it('KORR-RECHTE migration expands old grants losslessly, preserves nonfinancial grants, converts open/completed task recipients and restores every original guard',async()=>{
 const database=process.env.DATABASE_URL;
 if(!database||database!==process.env.H18_EXPECTED_DATABASE_URL||new URL(database).hostname!=='127.0.0.1'||new URL(database).pathname!=='/postgres')throw Error('TEST_FINANCIAL_MIGRATION_LOOPBACK_REQUIRED');
 const sql=postgres(database,{max:1,prepare:false}),tenant='TEST-rechte-'+randomUUID(),actor=randomUUID(),plain=randomUUID(),openId=randomUUID(),closedId=randomUUID(),invoiceTaskId=randomUUID(),priceTaskId=randomUUID(),customerId=randomUUID(),orderId=randomUUID(),rollback=new Error('TEST_MIGRATION_INTENTIONAL_ROLLBACK');
 const migration=readFileSync('supabase/migrations/20261117120653_split_financial_access_areas.sql','utf8');
 if(migration.includes(['TODO','PL'].join('_')))throw Error('TEST_MIGRATION_EXECUTION_CONTRACT_OPEN');
 try{
  try{await sql.begin(async tx=>{
   const [before]=await tx`SELECT pg_get_functiondef('private.protect_task_identity()'::regprocedure) AS task_guard,pg_get_functiondef('private.current_user_can_view_finance(text)'::regprocedure) AS finance_guard,(SELECT tgenabled::text FROM pg_trigger WHERE tgrelid='public.tasks'::regclass AND tgname='task_identity') AS enabled,has_function_privilege('anon','private.current_user_can_view_finance(text)','EXECUTE') AS anon,has_function_privilege('authenticated','private.current_user_can_view_finance(text)','EXECUTE') AS authenticated`;
   // Test adapter only, PL22.11.18:59: retain the current two post-state CHECK
   // vocabularies while exercising the original historical financial conversion.
   // No existing grant is hidden/deleted, and the production migration is unchanged.
   const postChecks=await tx`SELECT c.conname,pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c WHERE (c.conrelid='public.app_user_rights'::regclass AND c.conname='app_user_rights_bereich_chk')
     OR (c.conrelid='public.tasks'::regclass AND c.conname='tasks_fuer_bereich_check') ORDER BY c.conname`;
   expect(postChecks).toHaveLength(2);
   let applicableMigration=migration;
   for(const [table,name] of [['app_user_rights','app_user_rights_bereich_chk'],['tasks','tasks_fuer_bereich_check']] as const){
    const check=postChecks.find(row=>row.conname===name);if(!check)throw Error('TEST_CURRENT_POST_CHECK_REQUIRED');
    const pattern=new RegExp('ALTER TABLE public\\.'+table+' ADD CONSTRAINT '+name+' CHECK \\([\\s\\S]*?\\);','g');
    const matches=[...applicableMigration.matchAll(pattern)];expect(matches).toHaveLength(1);
    applicableMigration=applicableMigration.replace(pattern,'ALTER TABLE public.'+table+' ADD CONSTRAINT '+name+' '+check.definition+';');
   }
   const unrelatedRights=await tx`SELECT to_jsonb(rights) AS original FROM public.app_user_rights rights
    WHERE tenant_id<>${tenant} ORDER BY tenant_id,user_id,bereich`;
   // Recreate only the real prior CHECK vocabulary for isolated old-data fixtures.
   // NOT VALID retains unrelated modern rows; all inserted historical rows are checked.
   const oldRights=readFileSync('supabase/migrations/20261116134932_s20_logging_foundation.sql','utf8');
   const rightsCheck=oldRights.match(/ALTER TABLE public\.app_user_rights ADD CONSTRAINT app_user_rights_bereich_chk CHECK \([\s\S]*?\);/);
   if(!rightsCheck)throw Error('TEST_PRIOR_RIGHTS_CHECK_REQUIRED');
   await tx.unsafe('ALTER TABLE public.app_user_rights DROP CONSTRAINT app_user_rights_bereich_chk;'+rightsCheck[0].replace(/;$/,' NOT VALID;'));
   const taskSchema=readFileSync('supabase/migrations/20261104012000_ein4_nachrichten.sql','utf8');
   const taskCheck=taskSchema.match(/fuer_bereich text CHECK\((fuer_bereich IN \([^\n]+\))\),/);
   if(!taskCheck)throw Error('TEST_PRIOR_TASK_CHECK_REQUIRED');
   await tx.unsafe('ALTER TABLE public.tasks DROP CONSTRAINT tasks_fuer_bereich_check;ALTER TABLE public.tasks ADD CONSTRAINT tasks_fuer_bereich_check CHECK('+taskCheck[1]+') NOT VALID;');
   await tx`INSERT INTO public.app_users(id,tenant_id,email,full_name,role,active) VALUES(${actor}::uuid,${tenant},${actor+'@example.invalid'},'TEST alter Geld-Login','meister',true),(${plain}::uuid,${tenant},${plain+'@example.invalid'},'TEST Auftrag ohne Geld','werkstatt',true)`;
   await tx`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${tenant},${actor}::uuid,'geld',${plain}::uuid),(${tenant},${actor}::uuid,'auftraege',${actor}::uuid),(${tenant},${plain}::uuid,'auftraege',${actor}::uuid)`;
   await tx`INSERT INTO public.tasks(id,tenant_id,client_key,art,titel,faellig_am,vorlauf_tage,fuer_bereich,bezug_typ,status,erstellt_von,version,erledigt_von,erledigt_am,erledigt_notiz) VALUES
    (${openId}::uuid,${tenant},${openId}::uuid,'aufgabe','TEST offenes Original','2026-11-17',0,'geld','allgemein','offen',${plain}::uuid,7,NULL,NULL,NULL),
    (${closedId}::uuid,${tenant},${closedId}::uuid,'aufgabe','TEST abgeschlossenes Original','2026-11-16',0,'geld','allgemein','erledigt',${plain}::uuid,8,${plain}::uuid,'2026-11-16T12:00:00Z','TEST unveraenderter Abschluss')`;
   // Explicit historical SQL fixtures only; no product-writer claim. The
   // immutable event uses the same source type/link as the real canceled-mail task.
   await tx`INSERT INTO public.customers(id,tenant_id,name,type) VALUES(${customerId},${tenant},'TEST K4 migration customer','business')`;
   await tx`INSERT INTO public.orders(id,tenant_id,order_number,customer_id,title,current_station_id,status) VALUES(${orderId},${tenant},${'TEST-K4-'+orderId},${customerId},'TEST K4 original order','angenommen','angenommen')`;
   await tx`INSERT INTO public.tasks(id,tenant_id,client_key,art,titel,faellig_am,vorlauf_tage,fuer_bereich,bezug_typ,bezug_id,status,erstellt_von) VALUES
    (${invoiceTaskId}::uuid,${tenant},${invoiceTaskId}::uuid,'rechnung','TEST alte Eingangsrechnung','2026-11-17',0,'geld','eingangsrechnung',${randomUUID()},'offen',${plain}::uuid),
    (${priceTaskId}::uuid,${tenant},${priceTaskId}::uuid,'aufgabe','TEST alte Stornomail','2026-11-17',0,'geld','auftrag',${orderId},'offen',${plain}::uuid)`;
   await tx`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version)
    VALUES(${randomUUID()},${tenant},${orderId},'COMMUNICATION_INVOICE_TASK_CREATED_V1','TEST historical price source',${tx.json({taskId:priceTaskId,invoiceId:randomUUID()})}::jsonb,'success',${actor}::uuid,${randomUUID()}::uuid,1)`;
   const tasksBefore=await tx`SELECT row_to_json(task)::jsonb AS original FROM public.tasks task WHERE tenant_id=${tenant} ORDER BY id`;
   const plainBefore=await tx`SELECT bereich,granted_by::text FROM public.app_user_rights WHERE tenant_id=${tenant} AND user_id=${plain}::uuid ORDER BY bereich`;
   await tx.unsafe(applicableMigration);
   expect(await tx`SELECT c.conname,pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c WHERE (c.conrelid='public.app_user_rights'::regclass AND c.conname='app_user_rights_bereich_chk')
     OR (c.conrelid='public.tasks'::regclass AND c.conname='tasks_fuer_bereich_check') ORDER BY c.conname`).toEqual(postChecks);
   expect(await tx`SELECT to_jsonb(rights) AS original FROM public.app_user_rights rights
    WHERE tenant_id<>${tenant} ORDER BY tenant_id,user_id,bereich`).toEqual(unrelatedRights);
   expect(await tx`SELECT bereich,granted_by::text FROM public.app_user_rights WHERE tenant_id=${tenant} AND user_id=${actor}::uuid ORDER BY bereich`).toEqual([{bereich:'auftraege',granted_by:actor},{bereich:'buchhaltung',granted_by:plain},{bereich:'preise',granted_by:plain},{bereich:'zahlungen',granted_by:plain}]);
   expect(await tx`SELECT bereich,granted_by::text FROM public.app_user_rights WHERE tenant_id=${tenant} AND user_id=${plain}::uuid ORDER BY bereich`).toEqual(plainBefore);
   const tasksAfter=await tx`SELECT row_to_json(task)::jsonb AS original FROM public.tasks task WHERE tenant_id=${tenant} ORDER BY id`;
   const recipients=new Map([[openId,'zahlungen'],[closedId,'zahlungen'],[invoiceTaskId,'buchhaltung'],[priceTaskId,'preise']]);
   expect(tasksAfter).toEqual(tasksBefore.map(row=>{const area=recipients.get(row.original.id);if(!area)throw Error('TEST_K4_EXPECTED_RECIPIENT_MISSING');return {original:{...row.original,fuer_bereich:area}};}));
   expect(await tx`SELECT count(*)::int AS n FROM public.app_user_rights WHERE bereich='geld'`).toEqual([{n:0}]);
   expect(await tx`SELECT count(*)::int AS n FROM public.tasks WHERE fuer_bereich='geld'`).toEqual([{n:0}]);
   const [after]=await tx`SELECT pg_get_functiondef('private.protect_task_identity()'::regprocedure) AS task_guard,pg_get_functiondef('private.current_user_can_view_finance(text)'::regprocedure) AS finance_guard,(SELECT tgenabled::text FROM pg_trigger WHERE tgrelid='public.tasks'::regclass AND tgname='task_identity') AS enabled,has_function_privilege('anon','private.current_user_can_view_finance(text)','EXECUTE') AS anon,has_function_privilege('authenticated','private.current_user_can_view_finance(text)','EXECUTE') AS authenticated`;
   expect(after).toEqual({...before,finance_guard:before.finance_guard.replace("rights.bereich = 'geld'","rights.bereich = 'buchhaltung'")});
   // The completed original is still protected after the one-time conversion.
   await expect(tx.savepoint(async nested=>nested`UPDATE public.tasks SET titel='TEST forbidden change',version=version+1 WHERE id=${closedId}::uuid`)).rejects.toMatchObject({code:'23514'});
   throw rollback;
  });}catch(error){if(error!==rollback)throw error;}
  expect(await sql`SELECT id FROM public.app_users WHERE tenant_id=${tenant}`).toHaveLength(0);
 }finally{await sql.end({timeout:5});}
},60000);
