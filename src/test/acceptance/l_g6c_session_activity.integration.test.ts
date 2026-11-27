// @vitest-environment node
// Real authorization and settings in an isolated TEST tenant; only wall time is controlled.
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { createFixture, sql, withSession } from '../../../e2e/ablauf/replayHarness';
import { cookies } from 'next/headers';
import { getAuthorizationSnapshotAction, recordAppSessionActivity } from '@/app/actions/auth.actions';
import { getIntakeDraftsAction, saveIntakeDraftAction } from '@/app/actions/eingang.actions';
import { appSessionReadScope, COOKIE_NAME, readAppSession, setAppSession } from '@/lib/server/appSession';

it('expires a tablet session while preserving its saved draft for the same login', async () => {
  const actor = await createFixture(['auftraege', 'eingang'], 'meister');
  await sql`INSERT INTO public.company_settings (id, tenant_id, company_name, material_aufschlag_prozent,
    lager_regelversion, inaktivitaet_abmelden_minuten, inaktivitaet_abmelden_geraete, inaktivitaet_abmelden_rollen)
    VALUES (${randomUUID()}::uuid, ${tenant}, 'TEST Sitzung', 0, 'TEST-G6C', 60, '{"tablet":3}'::jsonb, '{"meister":2}'::jsonb)`;

  await withSession(actor, async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const original = { userId: actor.actorId, tenantId: tenant, role: actor.role, displayName: 'TEST Sitzung',
        device: 'tablet' as const, issuedAt: now, expiresAt: now + 12 * 60 * 60_000 };
      await setAppSession(original);
      const store = await cookies();
      const token = store.get(COOKIE_NAME)!.value;
      const scope = appSessionReadScope(token, original);
      expect(await getAuthorizationSnapshotAction()).toMatchObject({ ok: true,
        data: { inactivity: { expiresAt: now + 120_000, lastSeen: now, minutes: 2 } } });
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

      clock.mockReturnValue(now + 165_000);
      const expiredToken = store.get(COOKIE_NAME)!.value;
      expect(await getAuthorizationSnapshotAction()).toMatchObject({ ok: false });
      expect(await recordAppSessionActivity()).toEqual({ code: 'EXPIRED' });
      expect(await getIntakeDraftsAction()).toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(store.get(COOKIE_NAME)?.value).toBe(expiredToken);

      await setAppSession({ ...original, issuedAt: Date.now(), expiresAt: Date.now() + 12 * 60 * 60_000 });
      expect(store.get(COOKIE_NAME)?.value).not.toBe(expiredToken);
      expect(await getIntakeDraftsAction()).toEqual(saved);
    } finally { clock.mockRestore(); }
  });
}, 60_000);
