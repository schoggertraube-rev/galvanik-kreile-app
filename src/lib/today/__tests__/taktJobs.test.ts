// @vitest-environment node
import {beforeEach, describe, expect, it, vi} from 'vitest';

const rebuild = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/todayProjection', () => ({rebuildTodayModel: rebuild}));

import {HEUTE_TAKT_JOBS} from '../taktJobs';

beforeEach(() => rebuild.mockReset());

describe('täglicher Neuaufbau', () => {
  const job = HEUTE_TAKT_JOBS[0];
  const signal = new AbortController().signal;

  it('nutzt den vorhandenen vollen Projektor für den Mandanten', async () => {
    rebuild.mockResolvedValue({code: 'OK', built: 4, stale: 0});
    expect(await job.ausfuehren('tenant-a', signal)).toBe('ok');
    expect(rebuild).toHaveBeenCalledExactlyOnceWith('tenant-a', undefined, {bounded: true});
  });

  it('meldet unbelegte und blockierte Neuaufbauten als Fehler', async () => {
    rebuild.mockResolvedValueOnce({code: 'OK', built: 0, stale: 1}).mockResolvedValueOnce({code: 'BUSY'});
    await expect(job.ausfuehren('tenant-a', signal)).rejects.toThrow('TAKT_HEUTE_NEUAUFBAU_INCOMPLETE');
    await expect(job.ausfuehren('tenant-a', signal)).rejects.toThrow('TAKT_HEUTE_NEUAUFBAU_INCOMPLETE');
  });

  it('startet nach Abbruch keinen Projektor', async () => {
    const stopped = new AbortController();
    stopped.abort();
    await expect(job.ausfuehren('tenant-a', stopped.signal)).rejects.toMatchObject({name: 'AbortError'});
    expect(rebuild).not.toHaveBeenCalled();
  });
});
