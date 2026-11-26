// @vitest-environment node
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { expect, it, vi } from 'vitest';
import { refreshTodayModel } from '@/lib/server/todayProjection';

it('refreshes the current sender first and records the service outcome separately', async () => {
  const database = process.env.DATABASE_URL;
  if (!database || database !== process.env.H18_EXPECTED_DATABASE_URL ||
    new URL(database).hostname !== '127.0.0.1' || new URL(database).pathname !== '/postgres') {
    throw Error('TODAY_REFRESH_OWN_TEST_DATABASE_REQUIRED');
  }
  const tenant = `TEST-ablauf-${randomUUID()}`;
  const sql = postgres(database, { max: 1, prepare: false });
  const output = vi.spyOn(console, 'info');
  try {
    const actor = randomUUID();
    await sql.begin(async transaction => {
      await transaction`INSERT INTO public.app_users (id,tenant_id,email,full_name,role,active)
        VALUES (${actor}::uuid,${tenant},${`TEST-today-${actor}@local.invalid`},'TEST Today Office','meister',true)`;
      await transaction`INSERT INTO public.app_user_rights (tenant_id,user_id,bereich,granted_by)
        VALUES (${tenant},${actor}::uuid,'preise',${actor}::uuid)`;
    });
    await sql`INSERT INTO public.company_settings (id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,
      invoice_vat_rate_basis_points,invoice_payment_term_days,versand_pauschale_netto_cents,material_aufschlag_prozent,lager_regelversion,today_refresh_batch_limit)
      VALUES (${randomUUID()},${tenant},'TEST Previous Sender','TEST Road 1','70176','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14,1000,20,'TEST-Ablauf',1)`;
    await sql`INSERT INTO private.today_source_v1 (tenant_id,kind,source_id)
      VALUES (${tenant},'quelle:fundament.firma','*') ON CONFLICT DO NOTHING`;
    expect(await refreshTodayModel(tenant)).toEqual({ code: 'OK', built: 1, stale: 0 });
    const company = () => sql`SELECT payload->'company'->>'companyName' AS name FROM private.today_source_v1
      WHERE tenant_id=${tenant} AND kind='quelle:fundament.firma'`;
    expect(await company()).toEqual([{ name: 'TEST Previous Sender' }]);
    // These isolated fixture rows represent two other waiting sources. The
    // actual settings invalidator, source readers, lease and publication run below.
    await sql`INSERT INTO private.today_source_v1 (tenant_id,kind,source_id)
      VALUES (${tenant},'quelle:tasks.aufgabe','*'),(${tenant},'quelle:takt.ausfall','*')
      ON CONFLICT (tenant_id,kind,source_id) DO UPDATE SET source_seq=today_source_v1.source_seq+1,built_at=NULL`;
    await sql`UPDATE public.company_settings SET company_name='TEST Current Sender' WHERE tenant_id=${tenant}`;

    output.mockClear();
    expect(await refreshTodayModel(tenant)).toEqual({ code: 'OK', built: 1, stale: 0 });
    expect(await company()).toEqual([{ name: 'TEST Current Sender' }]);
    const unbuilt = () => sql`SELECT kind FROM private.today_source_v1 WHERE tenant_id=${tenant}
      AND source_seq<>built_seq AND kind IN ('quelle:tasks.aufgabe','quelle:takt.ausfall') ORDER BY kind`;
    expect(await unbuilt()).toEqual([{ kind: 'quelle:takt.ausfall' }, { kind: 'quelle:tasks.aufgabe' }]);

    expect(await refreshTodayModel(tenant, undefined, { bounded: true, taktErgebnis: true }))
      .toEqual({ code: 'OK', built: 1, stale: 0 });
    expect(await unbuilt()).toEqual([{ kind: 'quelle:tasks.aufgabe' }]);
    const phases = output.mock.calls.filter(call => call[0] === '[PAGE_READ_PHASE]')
      .map(call => JSON.parse(String(call[1])) as { phase: string; counts: unknown })
      .filter(entry => entry.phase === 'today.refresh' || entry.phase === 'today.taktAusfall');
    expect(phases.map(({ phase, counts }) => ({ phase, counts }))).toEqual([
      { phase: 'today.refresh', counts: { rows: 1, built: 1, stale: 0 } },
      { phase: 'today.taktAusfall', counts: { rows: 1, built: 1, stale: 0 } },
    ]);
  } finally {
    output.mockRestore();
    await sql.end({ timeout: 5 });
  }
}, 60_000);
