// @vitest-environment node
// Real authorization and settings in an isolated TEST tenant; only wall time is controlled.
import { randomInt, randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { customerFixture, intakeOrderFixture } from '../../../e2e/ablauf/orderFixture';
import { createFixture, full, sql, withRequest, withSession } from '../../../e2e/ablauf/replayHarness';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { getAuthorizationSnapshotAction, loginWithPin, recordAppSessionActivity } from '@/app/actions/auth.actions';
import { logout } from '@/app/actions/auth';
import { getIntakeDraftsAction, saveIntakeDraftAction } from '@/app/actions/eingang.actions';
import { replayOfflineWorkshopAction } from '@/app/actions/offlineWorkshop.actions';
import { getLiveOrderCardAction, transitionWareneingangToGalvanikAction } from '@/app/actions/orders.actions';
import { saveManagedUserAction } from '@/app/actions/settings.actions';
import type { PendingPhysicalWorkshopOriginal } from '@/lib/offline/pendingStore';
import { appSessionReadScope, COOKIE_NAME, readAppSession } from '@/lib/server/appSession';
import { offlinePartition } from '@/lib/server/offlinePartition';
import { createPinLoginHandle } from '@/lib/server/pinLoginHandle';
import { proxy } from '@/proxy';

const desktopAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';

it('expires a tablet session and resumes the same login’s saved draft and original', async () => {
  const actor = await createFixture(['auftraege', 'eingang'], 'meister');
  const other = await createFixture(['auftraege', 'eingang'], 'werkstatt');
  const manager = await createFixture(['einstellungen', 'logins']);
  const pin = String(randomInt(1000, 10000));
  const managed = await withSession(manager, () => saveManagedUserAction({
    userId: actor.actorId, fullName: 'TEST Sitzung', shortCode: 'V6', designation: 'TEST Tablet', active: true, pin,
  }));
  expect(managed).toMatchObject({code:'OK'});
  const [standard] = await sql<{minutes:number}[]>`SELECT private.s16d_inaktivitaet_standard() AS minutes`;
  expect(await withSession(full, () => getAuthorizationSnapshotAction())).toMatchObject({
    ok:true, data:{inactivity:{minutes:standard.minutes}},
  });
  await sql`INSERT INTO public.company_settings (id, tenant_id, company_name, material_aufschlag_prozent,
    lager_regelversion, inaktivitaet_abmelden_minuten, inaktivitaet_abmelden_geraete, inaktivitaet_abmelden_rollen)
    VALUES (${randomUUID()}::uuid, ${tenant}, 'TEST Sitzung', 0, 'TEST-G6C', 60, '{"tablet":2}'::jsonb, '{"meister":3}'::jsonb)`;
  const customerId = await customerFixture('TEST Inaktivität');
  const created = await intakeOrderFixture('TEST Inaktivität', customerId);
  const orderId = created.receipt.orderId;
  const card = await withSession(full, () => getLiveOrderCardAction({orderId}));
  if (card.code !== 'OK') throw Error('TEST_INACTIVITY_ORDER_NOT_READABLE');
  const moved = await withSession(full, () => transitionWareneingangToGalvanikAction({
    orderId, expectedVersion: card.data.card.version, clientEventId: randomUUID(),
  }));
  if (moved.code !== 'OK') throw Error('TEST_INACTIVITY_ORDER_NOT_READY');
  const commandId = randomUUID();
  const partition = offlinePartition({tenantId: tenant, userId: actor.actorId});
  const orderReceipts = () => sql`SELECT id, user_id::text FROM public.events WHERE tenant_id=${tenant}
    AND client_event_id=${commandId}::uuid AND event_type='ORDER_ITEM_FINISHED_CHANGED_V1'`;

  const handle = createPinLoginHandle(actor.actorId);
  await withRequest('', async () => {
    expect(await loginWithPin(handle, pin, 'tablet')).toMatchObject({ok:true});
    const initial = await readAppSession();
    if (!initial.ok) throw Error('TEST_ACTUAL_TABLET_LOGIN_REQUIRED');
    const original = initial.session;
    expect(original).toMatchObject({userId:actor.actorId, device:'tablet'});
    const now = original.issuedAt;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const store = await cookies();
      const token = store.get(COOKIE_NAME)!.value;
      const scope = appSessionReadScope(token, original);
      expect(await getAuthorizationSnapshotAction()).toMatchObject({ ok: true,
        data: { inactivity: { expiresAt: now + 120_000, lastSeen: now, minutes: 2, sessionScope: scope } } });
      const draftId = randomUUID();
      const payload = { clientKey: draftId, text: 'TEST Entwurf auf dem Tablet' };
      const draft = { id: draftId, art: 'eingang', payload, zuletzt_feld: 'text' };
      const saved = await saveIntakeDraftAction({ id: draftId, art: 'eingang', payload,
        lastField: 'text', expectedVersion: null, clientEventId: randomUUID() });
      expect(saved).toMatchObject({ code: 'OK', drafts: [draft] });

      clock.mockReturnValue(now + 45_000);
      expect(await recordAppSessionActivity()).toMatchObject({ code: 'OK', inactivity: { expiresAt: now + 165_000, lastSeen: now + 45_000 } });
      const refreshed = await readAppSession();
      if (!refreshed.ok) throw new Error('TEST signed session unavailable');
      expect(refreshed.session.expiresAt).toBe(original.expiresAt);
      expect(appSessionReadScope(store.get(COOKIE_NAME)!.value, refreshed.session)).toBe(scope);
      clock.mockReturnValue(now + 120_000);
      const renewedToken = store.get(COOKIE_NAME)!.value;
      expect(await logout({ sessionScope: scope })).toMatchObject({
        ok: false, code: 'ACTIVE', inactivity: { expiresAt: now + 165_000, sessionScope: scope },
      });
      expect(store.get(COOKIE_NAME)?.value).toBe(renewedToken);

      const pending: PendingPhysicalWorkshopOriginal = {
        id: commandId, kind: 'workshop', itemId: orderId, command: 'item.finished',
        deviceCapturedAt: new Date(now + 47_000).toISOString(), notBefore: new Date(now + 57_000).toISOString(),
        input: {orderId, itemId: created.receipt.items[0].id, expectedVersion: moved.receipt.aggregateVersion,
          clientEventId: commandId, finished: true},
      };
      clock.mockReturnValue(now + 165_000);
      const expiredToken = store.get(COOKIE_NAME)!.value;
      expect(await getAuthorizationSnapshotAction()).toMatchObject({ ok: false });
      expect(await recordAppSessionActivity()).toEqual({ code: 'EXPIRED' });
      expect(await getIntakeDraftsAction()).toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(await replayOfflineWorkshopAction(partition, pending)).toEqual({code:'UNAUTHENTICATED'});
      expect(store.get(COOKIE_NAME)?.value).toBe(expiredToken);
      const staleStart = await proxy(new NextRequest('http://127.0.0.1/start', {
        headers: {cookie: `${COOKIE_NAME}=${expiredToken}`, 'user-agent': desktopAgent},
      }));
      expect(staleStart.status).toBe(200);
      expect(staleStart.headers.get('location')).toBeNull();
      await withSession(other, async () => {
        expect(await replayOfflineWorkshopAction(partition, pending)).toEqual({code:'FORBIDDEN'});
        expect(await getIntakeDraftsAction()).toEqual({code:'OK',drafts:[]});
      });
      expect(await orderReceipts()).toEqual([]);
      expect(await logout({ sessionScope: scope })).toMatchObject({ ok: true });
      expect(store.get(COOKIE_NAME)?.value).toBe(expiredToken);
      expect(await getAuthorizationSnapshotAction()).toMatchObject({ ok: false });
      expect(await getIntakeDraftsAction()).toMatchObject({ code: 'UNAUTHENTICATED' });

      await withRequest('', async () => {
        expect(await loginWithPin(handle, pin, 'tablet')).toMatchObject({ok:true});
        const newStore = await cookies();
        const newToken = newStore.get(COOKIE_NAME)?.value;
        expect(newToken).toBeTruthy();
        expect(newToken).not.toBe(expiredToken);
        expect(await logout({ sessionScope: scope })).toEqual({ ok: false, code: 'SESSION_CHANGED' });
        expect(newStore.get(COOKIE_NAME)?.value).toBe(newToken);
        expect(await getIntakeDraftsAction()).toEqual(saved);
        const applied = await replayOfflineWorkshopAction(partition, structuredClone(pending));
        expect(applied.code).toBe('OK');
        if (applied.code !== 'OK' || !('offlineReceipt' in applied)) throw Error('TEST_INACTIVITY_RECEIPT_REQUIRED');
        expect(applied.offlineReceipt).toMatchObject({scope: partition, clientEventId: commandId, actorId: actor.actorId,
          deviceCapturedAt: pending.deviceCapturedAt});
        expect(await replayOfflineWorkshopAction(partition, structuredClone(pending))).toMatchObject({
          code:'OK', offlineReceipt: applied.offlineReceipt,
        });
        expect(await orderReceipts()).toEqual([{id: applied.offlineReceipt.eventId, user_id: actor.actorId}]);
      }, false, {'user-agent':desktopAgent});
    } finally { clock.mockRestore(); }
  }, false, {'user-agent':desktopAgent});
}, 60_000);
