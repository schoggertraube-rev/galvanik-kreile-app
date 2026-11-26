// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { sql as query } from 'drizzle-orm';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { customerFixture, intakeOrderFixture } from '../../../e2e/ablauf/orderFixture';
import { createFixture, sql, withSession } from '../../../e2e/ablauf/replayHarness';
import { completeIntakeTaskAction, getIntakeTaskAction } from '@/app/actions/eingang.actions';
import { resolveAuthorization } from '@/lib/server/authorization';
import { withPrivilegedTenantTransaction } from '@/lib/server/privilegedDb';
import { readCustomerProfile } from '@/modules/customers/server-public';
import { recordIntakeTaskEffect } from '@/modules/eingang/server-public';
import { readAusschussBerechnenInTransaction } from '@/modules/fundament/server-public';
import { synchronizeFullScrapTask, type TaskEffects } from '@/modules/tasks/server-public';

const titel = 'Alle Teile Ausschuss – Reklamation oder Nacharbeit festlegen';
const effect: TaskEffects = (tx, actor, request) => recordIntakeTaskEffect(tx, actor, request, readCustomerProfile);
const deps = { effect, readChargeScrap: readAusschussBerechnenInTransaction };

it('legt das Ausschuss-Anliegen mit echtem Auftragsbezug und Verlauf genau einmal an', async () => {
  const ersterLogin = await createFixture(['auftraege'], 'buero');
  const zweiterLogin = await createFixture(['auftraege'], 'buero');
  const ohneAuftraege = await createFixture(['kunden'], 'buero');
  const kunde = await customerFixture('B2a Ausschuss');
  const { receipt: auftrag } = await intakeOrderFixture('B2a Ausschuss', kunde, 'pickup', 10);

  // Isolierte TEST-Einstellung. Die Ausschussmenge kommt in B2-a aus dem Auftragsbefehl.
  await sql`INSERT INTO public.company_settings (id, tenant_id, company_name, ausschuss_berechnen,
    material_aufschlag_prozent, lager_regelversion)
    VALUES (${randomUUID()}, ${tenant}, 'TEST B2-a', true, 20, 'TEST-B2A')`;

  const anliegen = (actor: typeof ersterLogin, vollstaendig: boolean, provoziereAbbruch = false) => withSession(actor, async () => {
    const auth = await resolveAuthorization();
    if (!auth.ok) throw Error('TEST_B2A_AUTH');
    return withPrivilegedTenantTransaction(auth.data, async tx => {
      const taskId = await synchronizeFullScrapTask(tx, auth.data, { orderId: auftrag.orderId, vollstaendig, titel }, deps);
      if (provoziereAbbruch) await tx.execute(query`SELECT 1/0`);
      return taskId;
    });
  });

  expect(await anliegen(ersterLogin, true)).toBeNull();
  await sql`UPDATE public.company_settings SET ausschuss_berechnen = false WHERE tenant_id = ${tenant}`;
  expect(await anliegen(ersterLogin, false)).toBeNull();
  await expect(anliegen(ohneAuftraege, true)).rejects.toThrow('FORBIDDEN');
  await expect(anliegen(ersterLogin, true, true)).rejects.toThrow(/division by zero|SELECT 1\/0/i);
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id = ${tenant}`).toHaveLength(0);
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id = ${tenant} AND nachher->>'action' = 'aufgabe.angelegt'`).toHaveLength(0);

  const [taskId, parallel] = await Promise.all([anliegen(ersterLogin, true), anliegen(zweiterLogin, true)]);
  expect(taskId).toBeTruthy();
  expect(parallel).toBe(taskId);
  if (!taskId) throw Error('TEST_B2A_AUFGABE_FEHLT');
  expect(await anliegen(ersterLogin, true)).toBe(taskId);
  expect(await sql`SELECT id::text, titel, status, fuer_bereich, bezug_typ, bezug_id FROM public.tasks WHERE tenant_id = ${tenant}`)
    .toEqual([{ id: taskId, titel, status: 'offen', fuer_bereich: 'auftraege', bezug_typ: 'auftrag', bezug_id: auftrag.orderId }]);
  expect(await sql`SELECT von::text FROM public.intake_event WHERE tenant_id = ${tenant} AND nachher->>'taskId' = ${taskId}`)
    .toEqual([{ von: expect.stringMatching(new RegExp(`^(?:${ersterLogin.actorId}|${zweiterLogin.actorId})$`)) }]);

  expect(await anliegen(zweiterLogin, false)).toBeNull();
  const gelesen = await withSession(zweiterLogin, () => getIntakeTaskAction({ taskId }));
  expect(gelesen).toMatchObject({ code: 'OK', canOpenReference: true, reference: { type: 'auftrag', id: auftrag.orderId },
    task: { id: taskId, titel, status: 'offen' } });
  if (gelesen.code !== 'OK' || !gelesen.task) throw Error('TEST_B2A_AUFGABE_NICHT_LESBAR');
  const { version } = gelesen.task;
  const abgeschlossen = await withSession(zweiterLogin, () => completeIntakeTaskAction({ taskId, version, note: null }));
  expect(abgeschlossen).toMatchObject({ code: 'OK', task: { id: taskId, status: 'erledigt' } });
  expect(await anliegen(ersterLogin, true)).toBe(taskId);
  expect(await sql`SELECT id::text, status FROM public.tasks WHERE tenant_id = ${tenant}`).toEqual([{ id: taskId, status: 'erledigt' }]);
});
