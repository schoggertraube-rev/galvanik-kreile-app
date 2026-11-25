import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { encodeReply } from 'next/dist/compiled/react-server-dom-turbopack/client.node.js';

const tenantId = 'galvanik-kreile';
const appUrl = 'http://127.0.0.1:3100';
const supabaseUrl = 'http://127.0.0.1:54321';
const previewPath = '/api/heute/modell?nur=veraltet';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function readPreviewRevision() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'S38B_FRESH_HOST_REQUIRED');
  const { pull_request: pr } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  if (!pr) return null;
  const head = pr.head.sha;
  const base = pr.base.sha;
  assert.match(head, /^[0-9a-f]{40}$/);
  assert.match(base, /^[0-9a-f]{40}$/);
  const migrations = git('diff', '--name-only', '--diff-filter=A', base, head, '--', 'supabase/migrations');
  if (!migrations.split('\n').some(file => /^supabase\/migrations\/\d{14}_s38b_takt_job_runs\.sql$/.test(file))) return null;
  assert.equal(git('diff', '--name-only', head, 'HEAD', '--', 'src', 'supabase/migrations', 'next.config.ts', 'vercel.json'), '', 'S38B_APP_HEAD_MISMATCH');
  return head;
}

function findEmailLogin() {
  const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8'));
  const entries = Object.entries(manifest.node ?? {}).filter(([, action]) =>
    action.exportedName === 'login' && action.filename?.replace(/^\.\//, '') === 'src/app/actions/auth.ts' &&
    Object.keys(action.workers ?? {}).some(route => route === 'app/start/page' || route === 'src/app/start/page'));
  assert.equal(entries.length, 1, 'S38B_EMAIL_LOGIN_ACTION_REQUIRED');
  return entries[0][0];
}

async function getCookie(email, password) {
  const form = new FormData();
  form.set('email', email);
  form.set('password', password);
  const response = await fetch(`${appUrl}/start?mode=email`, {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(20_000),
    headers: { Origin: appUrl, Accept: 'text/x-component', 'Next-Action': findEmailLogin() },
    body: await encodeReply([form]),
  });
  assert.ok([200, 303].includes(response.status), `S38B_EMAIL_LOGIN_HTTP_${response.status}`);
  const cookies = response.headers.getSetCookie();
  await response.body?.cancel();
  const session = cookies.find(cookie => cookie.startsWith('kreile_app_session=') && /;\s*HttpOnly(?:;|$)/i.test(cookie));
  assert.ok(session, 'S38B_APP_SESSION_REQUIRED');
  return session.split(';', 1)[0];
}

async function verifyTakt(db, cookie) {
  const read = (path, timeout = 12_000) => fetch(appUrl + path, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(timeout) });
  const list = () => db`SELECT job_schluessel,faellig_fuer,status,versuch FROM public.takt_job_runs WHERE tenant_id=${tenantId} ORDER BY gestartet_um`;
  const before = await list();
  const takt = await read('/api/takt', 55_000);
  await takt.body?.cancel();
  assert.equal(takt.status, 200, 'S38B_DIAGNOSTIC_RUN_HTTP');
  const scheduled = (await list()).filter(row => row.job_schluessel !== 'takt.nachholen' &&
    !before.some(old => old.job_schluessel === row.job_schluessel && old.faellig_fuer === row.faellig_fuer));
  assert.ok(scheduled.length > 0, 'S38B_TODAY_RUN_RECEIPT');

  const minute = async () => {
    const [clock] = await db`SELECT to_char(clock_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD"T"HH24:MI') AS key,
      extract(second FROM clock_timestamp())::int AS second`;
    return clock;
  };
  let first = await minute();
  if (first.second > 42) {
    await sleep((61 - first.second) * 1000);
    first = await minute();
  }
  const responses = await Promise.all([read(previewPath), read(previewPath)]);
  assert.deepEqual(responses.map(response => response.status), [200, 200], 'S38B_TODAY_HTTP_PAIR');
  const models = await Promise.all(responses.map(response => response.json()));
  assert.ok(models.every(result => result.code === 'OK' && result.model?.dashboard), 'S38B_TODAY_FULL_MODEL');
  assert.equal((await minute()).key, first.key, 'S38B_BERLIN_MINUTE_MISMATCH');

  for (let attempt = 0; attempt < 25; attempt++) {
    const rows = await db`SELECT job_schluessel,faellig_fuer,status,versuch FROM public.takt_job_runs
      WHERE tenant_id=${tenantId} AND job_schluessel='takt.nachholen' AND faellig_fuer=${first.key}`;
    assert.ok(rows.length <= 1, 'S38B_DUPLICATE_CATCHUP');
    if (rows[0]?.status === 'ok') {
      assert.equal(rows[0].versuch, 1, 'S38B_CATCHUP_ATTEMPT');
      return { diagnosticHttp: takt.status, todayHttp: [200, 200], berlinMinute: first.key, scheduled, catchUp: rows };
    }
    await sleep(400);
  }
  throw Error('S38B_CATCHUP_RECEIPT_MISSING');
}

async function main() {
  const head = readPreviewRevision();
  if (!head) return;
  assert.equal(process.env.CRON_SECRET ?? '', '', 'S38B_PREVIEW_REQUIRES_NO_CRON_SECRET');
  const databaseUrl = new URL(process.env.DATABASE_URL);
  assert.deepEqual([databaseUrl.hostname, databaseUrl.port, databaseUrl.pathname], ['127.0.0.1', '54322', '/postgres']);
  const local = JSON.parse(execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000,
  }));
  assert.equal(local.API_URL, supabaseUrl, 'S38B_LOCAL_AUTH_REQUIRED');
  assert.ok(typeof local.SERVICE_ROLE_KEY === 'string' && local.SERVICE_ROLE_KEY.length > 0, 'S38B_LOCAL_AUTH_ADMIN_REQUIRED');
  const authAdmin = (method, endpoint, data) => fetch(`${supabaseUrl}/auth/v1/admin/users${endpoint}`, {
    method, signal: AbortSignal.timeout(12_000), body: JSON.stringify(data),
    headers: { apikey: local.SERVICE_ROLE_KEY, Authorization: `Bearer ${local.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
  });

  const db = postgres(databaseUrl.href, { max: 2, prepare: false, connect_timeout: 8 });
  const id = randomUUID();
  const email = `test-takt-${id}@local.invalid`;
  const password = `${randomBytes(24).toString('base64url')}1aA!`;
  let authId;
  try {
    const [policy] = await db`SELECT count(protokoll_aufbewahrung_tage)::int AS configured FROM public.company_settings WHERE tenant_id=${tenantId}`;
    assert.equal(policy.configured, 0, 'S38B_FRESH_RETENTION_MUST_BE_OFF');
    const created = await authAdmin('POST', '', { email, password, email_confirm: true });
    assert.ok(created.ok, `S38B_TEMPORARY_ACCOUNT_HTTP_${created.status}`);
    authId = (await created.json()).id;
    assert.match(authId, /^[0-9a-f-]{36}$/i);
    await db.begin(async tx => {
      await tx`INSERT INTO public.app_users (id,tenant_id,email,full_name,role,active)
        VALUES (${id}::uuid,${tenantId},${email},'TEST Tagesautomatik','developer',true)`;
      await tx`INSERT INTO public.app_user_rights (tenant_id,user_id,bereich,granted_by)
        VALUES (${tenantId},${id}::uuid,'wartung',${id}::uuid)`;
    });
    const result = await verifyTakt(db, await getCookie(email, password));
    console.log('S38B_PREVIEW_RESULT=' + JSON.stringify({ head, ...result }));
  } finally {
    try {
      try {
        await db`UPDATE public.app_users SET active=false WHERE id=${id}::uuid AND tenant_id=${tenantId} AND email=${email}`;
      } finally {
        if (authId) {
          const disabled = await authAdmin('PUT', `/${authId}`, { ban_duration: '8760h' });
          assert.ok(disabled.ok, 'S38B_TEMPORARY_AUTH_NOT_DISABLED');
          await disabled.body?.cancel();
          console.log('S38B_PREVIEW_TEST_LOGIN_DISABLED=true');
        }
      }
    } finally {
      await db.end({ timeout: 4 });
    }
  }
}

await main().catch(error => {
  const message = error?.message;
  console.error(typeof message === 'string' && /^S38B_[A-Z0-9_]+$/.test(message) ? message : 'S38B_PREVIEW_FAILED');
  process.exitCode = 1;
});
