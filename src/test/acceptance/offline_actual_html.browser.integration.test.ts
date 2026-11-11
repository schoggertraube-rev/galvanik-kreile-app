// @vitest-environment node
// Actual Next/Auth/DB page warming only; not an offline cold-start acceptance.
import {it,expect} from 'vitest';
import {spawn,execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import postgres from 'postgres';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {signAppSession,cacheScopeFromCredential,COOKIE_NAME} from '@/lib/server/appSession';
import {CACHE_SCOPE_COOKIE} from '@/lib/offline/cacheScopeMarker';
it.skipIf(process.env.KREILE_REAL_NEXT_CACHE_PROOF!=='1'||!process.env.KREILE_PLAYWRIGHT_CLI_JS)('warms only the real authenticated Next HTML and keeps original session authorization real',async()=>{
 const database=process.env.DATABASE_URL;
 if(!database||database!==process.env.H18_EXPECTED_DATABASE_URL||new URL(database).hostname!=='127.0.0.1'||new URL(database).port!=='54342')throw Error('TEST_OWN_REPLAY_REQUIRED');
 const sql=postgres(database,{max:1,prepare:false}),actor=randomUUID(),secret='TEST-actual-html-'+randomUUID(),port=3187,origin='http://127.0.0.1:'+port;
 const [flag]=await sql`SELECT enabled,roles_allowed FROM public.feature_flags WHERE id='offline_24h'`;
 if(!flag)throw Error('TEST_EXISTING_FLAG_REQUIRED');
 const issued=Date.now();
 await sql`INSERT INTO public.app_users(id,tenant_id,email,full_name,role,active,created_at,updated_at) VALUES(${actor}::uuid,${KREILE_TENANT_SLUG},${'TEST-cache-'+actor+'@example.invalid'},'TEST actual cache proof','meister',true,${new Date(issued-5000).toISOString()}::timestamptz,${new Date(issued-5000).toISOString()}::timestamptz)`;
 await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) SELECT ${KREILE_TENANT_SLUG},${actor}::uuid,area,${actor}::uuid FROM unnest(ARRAY['kunden','auftraege','eingang','mails','geld','einstellungen']) area`;
 await sql`UPDATE public.feature_flags SET enabled=true,roles_allowed=ARRAY['meister']::text[] WHERE id='offline_24h'`;
 const token=signAppSession({userId:actor,tenantId:KREILE_TENANT_SLUG,role:'meister',displayName:'TEST actual cache proof',issuedAt:issued,expiresAt:issued+600000},secret),login=cacheScopeFromCredential(token);
 const local=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 if(new URL(local.API_URL).hostname!=='127.0.0.1'||!local.ANON_KEY||!local.SERVICE_ROLE_KEY)throw Error('TEST_LOCAL_API_REQUIRED');
 const output=createWriteStream('.git/kreile-s03-actual-next-server.log',{flags:'w'});
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,APP_SESSION_SECRET:secret,NEXT_PUBLIC_SUPABASE_URL:local.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:local.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY},windowsHide:true,stdio:['ignore','pipe','pipe']});
 child.stdout.pipe(output);child.stderr.pipe(output);
 const execute=promisify(execFile),session='TEST-actual-html-'+randomUUID();
 const cli=async(args:string[])=>{const result=await execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{timeout:90000,maxBuffer:1024*1024});if(result.stdout.includes('### Error'))throw Error('TEST_BROWSER_COMMAND_FAILED:'+result.stdout.slice(0,600));return result;};
 try{
  let ready=false;
  for(let i=0;i<90;i++){
   try{const response=await fetch(origin+'/sw.js',{signal:AbortSignal.timeout(1500)});if(response.ok){ready=true;break;}}catch{}
   if(child.exitCode!==null)throw Error('TEST_NEXT_EXITED');
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!ready)throw Error('TEST_NEXT_NOT_READY');
  // Server resolves the genuine signed session against the real Replay user/rights.
  const response=await fetch(origin+'/customers',{headers:{cookie:COOKIE_NAME+'='+token+'; '+CACHE_SCOPE_COOKIE+'='+login},signal:AbortSignal.timeout(120000)});
  const html=await response.text();expect(response.status).toBe(200);expect(html).toContain('data-auth-status="authenticated"');expect(html).toContain('data-offline-24h="enabled"');expect(html).toContain('data-offline-login-scope="'+login+'"');
  await cli(['open',origin+'/sw.js']);
  const cookies=[{name:COOKIE_NAME,value:token,url:origin,httpOnly:true,sameSite:'Lax'},{name:CACHE_SCOPE_COOKIE,value:login,url:origin,sameSite:'Lax'}];
  await cli(['run-code',`async(page)=>{await page.context().addCookies(${JSON.stringify(cookies)});await page.goto('${origin}/customers');await page.getByRole('heading',{name:'Kunden & Kontakt',exact:true}).waitFor({timeout:15000});}`]);
  const proof=await cli(['eval',`async()=>{for(let i=0;i<100;i++){const names=(await caches.keys()).filter(n=>n.startsWith('kreile-private-')&&n.includes('${login}'));if(names.length===1){const response=await caches.match(location.href,{cacheName:names[0]});if(response){const text=await response.text();if(!text.includes('data-auth-status="authenticated"')||!text.includes('data-offline-login-scope="${login}"'))throw Error('TEST_UNQUALIFIED_CONTENT');return {actualNextHTML:true,qualifiedCache:true};}}await new Promise(r=>setTimeout(r,100));}throw Error('TEST_REAL_HTML_NOT_WARMED');}`]);
  expect(proof.stdout).not.toContain('### Error');expect(proof.stdout).toContain('"actualNextHTML": true');
 }finally{
  await cli(['close']).catch(()=>{});
  if(child.pid&&child.exitCode===null){if(process.platform==='win32')await execute('taskkill',['/PID',String(child.pid),'/T','/F']).catch(()=>{});else child.kill('SIGTERM');}
  output.end();
  await sql`UPDATE public.feature_flags SET enabled=${flag.enabled},roles_allowed=${flag.roles_allowed}::text[] WHERE id='offline_24h'`;
  await sql`UPDATE public.app_users SET active=false,updated_at=statement_timestamp() WHERE id=${actor}::uuid AND email=${'TEST-cache-'+actor+'@example.invalid'}`;
  await sql.end({timeout:3});
 }
},240000);
