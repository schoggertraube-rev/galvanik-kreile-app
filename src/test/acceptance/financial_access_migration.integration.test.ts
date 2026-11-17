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
 const sql=postgres(database,{max:1,prepare:false}),tenant='TEST-rechte-migration-'+randomUUID(),actor=randomUUID(),plain=randomUUID(),openId=randomUUID(),closedId=randomUUID(),rollback=new Error('TEST_MIGRATION_INTENTIONAL_ROLLBACK');
 const migration=readFileSync('supabase/migrations/20261117120653_split_financial_access_areas.sql','utf8');
 if(migration.includes('TODO_PL'))throw Error('TEST_MIGRATION_EXECUTION_CONTRACT_OPEN');
 try{
  try{await sql.begin(async tx=>{
   const [before]=await tx`SELECT pg_get_functiondef('private.protect_task_identity()'::regprocedure) AS task_guard,pg_get_functiondef('private.current_user_can_view_finance(text)'::regprocedure) AS finance_guard,(SELECT tgenabled::text FROM pg_trigger WHERE tgrelid='public.tasks'::regclass AND tgname='task_identity') AS enabled,has_function_privilege('anon','private.current_user_can_view_finance(text)','EXECUTE') AS anon,has_function_privilege('authenticated','private.current_user_can_view_finance(text)','EXECUTE') AS authenticated`;
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
   const tasksBefore=await tx`SELECT row_to_json(task)::jsonb AS original FROM public.tasks task WHERE tenant_id=${tenant} ORDER BY id`;
   const plainBefore=await tx`SELECT bereich,granted_by::text FROM public.app_user_rights WHERE tenant_id=${tenant} AND user_id=${plain}::uuid ORDER BY bereich`;
   await tx.unsafe(migration);
   expect(await tx`SELECT bereich,granted_by::text FROM public.app_user_rights WHERE tenant_id=${tenant} AND user_id=${actor}::uuid ORDER BY bereich`).toEqual([{bereich:'auftraege',granted_by:actor},{bereich:'buchhaltung',granted_by:plain},{bereich:'preise',granted_by:plain},{bereich:'zahlungen',granted_by:plain}]);
   expect(await tx`SELECT bereich,granted_by::text FROM public.app_user_rights WHERE tenant_id=${tenant} AND user_id=${plain}::uuid ORDER BY bereich`).toEqual(plainBefore);
   const tasksAfter=await tx`SELECT row_to_json(task)::jsonb AS original FROM public.tasks task WHERE tenant_id=${tenant} ORDER BY id`;
   expect(tasksAfter).toEqual(tasksBefore.map(row=>({original:{...row.original,fuer_bereich:'zahlungen'}})));
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
