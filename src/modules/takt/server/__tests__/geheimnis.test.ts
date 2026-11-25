// @vitest-environment node
import {afterEach, describe, expect, it, vi} from 'vitest';

const resolveAuthorization = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/authorization', () => ({resolveAuthorization}));

import {pruefeTaktHandzugriff, pruefeTaktZugriff} from '../geheimnis';

const originalSecret = process.env.CRON_SECRET;
const request = (authorization?: string) => new Request('https://example.test/api/takt', {
  headers: authorization ? {authorization} : undefined,
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
  resolveAuthorization.mockReset();
});

describe('Takt-Zugriff', () => {
  it('weist fehlende und falsche Cron-Geheimnisse ohne Anmeldelesen ab', async () => {
    process.env.CRON_SECRET = 'test-secret';
    expect(await pruefeTaktZugriff(request())).toEqual({code: 'DENIED', status: 401});
    expect(await pruefeTaktZugriff(request('Bearer wrong'))).toEqual({code: 'DENIED', status: 401});
    expect(resolveAuthorization).not.toHaveBeenCalled();
    expect(await pruefeTaktZugriff(request('Bearer test-secret'))).toEqual({code: 'CRON'});
    expect(resolveAuthorization).not.toHaveBeenCalled();
  });

  it('beschränkt den Handaufruf ohne Cron-Geheimnis auf die eigene Diagnose-Anmeldung', async () => {
    delete process.env.CRON_SECRET;
    resolveAuthorization.mockResolvedValueOnce({ok: false});
    expect(await pruefeTaktZugriff(request())).toEqual({code: 'DENIED', status: 401});
    resolveAuthorization.mockResolvedValueOnce({ok: true, data: {tenantId: 'tenant-a', permissions: []}});
    expect(await pruefeTaktZugriff(request())).toEqual({code: 'DENIED', status: 403});
    resolveAuthorization.mockResolvedValueOnce({ok: true, data: {tenantId: 'tenant-a', permissions: ['perm_sys_diag']}});
    expect(await pruefeTaktZugriff(request())).toEqual({code: 'LOGIN', tenantId: 'tenant-a'});
  });

  it('bindet die frühere Cron-Route auch bei konfiguriertem Secret an ein echtes Diagnose-Login', async () => {
    process.env.CRON_SECRET = 'test-secret';
    resolveAuthorization.mockResolvedValueOnce({ok: true, data: {tenantId: 'tenant-a', permissions: []}})
      .mockResolvedValueOnce({ok: true, data: {tenantId: 'tenant-a', permissions: ['perm_sys_diag']}});
    expect(await pruefeTaktHandzugriff()).toEqual({code: 'DENIED', status: 403});
    expect(await pruefeTaktHandzugriff()).toEqual({code: 'LOGIN', tenantId: 'tenant-a'});
  });
});
