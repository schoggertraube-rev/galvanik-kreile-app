// @vitest-environment node
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {hasPageReadBudget} from '@/db/readBudget';

const transaction = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/privilegedDb', async original => ({
  ...await original<typeof import('@/lib/server/privilegedDb')>(),
  withPrivilegedTenantTransaction: transaction,
}));

import {taktJobs} from '../server/taktJobs';

beforeEach(() => { transaction.mockReset(); });

describe('Protokoll-Aufbewahrungsjob', () => {
  const job = taktJobs[0];
  const signal = new AbortController().signal;

  it('behält bei leerer Einstellung sämtliche Daten', async () => {
    expect(await job.ausfuehren('tenant-a', signal, {protokollAufbewahrungTage: async () => null})).toBe('ok');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('löscht nur die beiden eigenen Tabellen im Mandantenkontext', async () => {
    const execute = vi.fn().mockResolvedValue([]);
    transaction.mockImplementation(async (_tenant, work) => {
      expect(hasPageReadBudget()).toBe(true);
      return work({execute});
    });
    expect(await job.ausfuehren('tenant-a', signal, {protokollAufbewahrungTage: async () => 30})).toBe('ok');
    expect(transaction).toHaveBeenCalledWith({tenantId: 'tenant-a'}, expect.any(Function));
    expect(execute).toHaveBeenCalledTimes(3);
    const commands = execute.mock.calls.map(([query]) => query.queryChunks.map((part: {value?: string[]}) => part.value?.join('') ?? '').join(''));
    expect(commands[0]).toContain("SET LOCAL app.protocol_retention='on'");
    expect(commands[1]).toContain('DELETE FROM public.technical_protocol WHERE tenant_id=');
    expect(commands[2]).toContain('DELETE FROM public.app_usage_events WHERE tenant_id=');
    expect(commands[2]).toContain("event_type='action'");
    expect(commands.join('\n')).not.toContain('takt_job_runs');
  });

  it('beginnt nach Abbruch keine Löschung', async () => {
    const stopped = new AbortController();
    stopped.abort();
    await expect(job.ausfuehren('tenant-a', stopped.signal, {protokollAufbewahrungTage: async () => 30}))
      .rejects.toMatchObject({name: 'AbortError'});
    expect(transaction).not.toHaveBeenCalled();
  });
});
