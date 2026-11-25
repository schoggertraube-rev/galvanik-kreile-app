// @vitest-environment node
import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.hoisted(() => { process.env.DATABASE_URL ??= 'postgres://test:test@127.0.0.1:1/test'; });
const readLoggingSettings = vi.fn();

import {taeglichFaelligAb} from '@/lib/domain/workingDays';
import {PACKAGE_SWITCHES, mapPackageSwitchRows} from '@/modules/fundament/public';
import {TAKT_JOBS, bauePaketAktiv, baueTaktLeser} from '../jobs';

beforeEach(() => readLoggingSettings.mockReset());

describe('Mandantenleser des Takts', () => {
  it('liest Paketwerte erst beim ersten Paketjob und im Mandantenlauf nur einmal', async () => {
    const values = mapPackageSwitchRows(PACKAGE_SWITCHES.map(({id}) => ({id, enabled:id==='p4_lager', roles:null})));
    const read = vi.fn(async () => values);
    const paketAktiv = bauePaketAktiv('tenant-a',read);
    expect(read).not.toHaveBeenCalled();
    expect(await paketAktiv('p4_lager')).toBe(true);
    expect(await paketAktiv('p5_tag')).toBe(false);
    expect(read).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledWith('tenant-a');
  });
  it('führt die beiden bestehenden Fachjobs genau einmal zusammen', () => {
    expect(TAKT_JOBS.map(job => job.schluessel)).toEqual(['heute_neuaufbau', 'protokoll_aufbewahrung']);
  });
  it.each([0, 1, null])('gibt den belegten Aufbewahrungswert %s unverändert weiter', async value => {
    readLoggingSettings.mockResolvedValue({retentionDays: value});
    expect(await baueTaktLeser('tenant-a', readLoggingSettings).protokollAufbewahrungTage()).toBe(value);
    expect(readLoggingSettings).toHaveBeenCalledWith({tenantId: 'tenant-a'});
  });

  it('behandelt einen fehlenden Einstellungsbeleg nicht als abgeschaltete Löschung', async () => {
    readLoggingSettings.mockResolvedValue(null);
    await expect(baueTaktLeser('tenant-a', readLoggingSettings).protokollAufbewahrungTage())
      .rejects.toThrow('TAKT_LOG_SETTINGS_INCOMPLETE');
  });

  it('reicht demselben Job und der Takt-Aufräumung denselben Einstellungsbeleg weiter', async () => {
    readLoggingSettings.mockResolvedValueOnce({retentionDays: 1}).mockResolvedValueOnce({retentionDays: 30});
    const leser = baueTaktLeser('tenant-a', readLoggingSettings);
    expect(await leser.protokollAufbewahrungTage()).toBe(1);
    expect(await leser.protokollAufbewahrungTage()).toBe(1);
    expect(readLoggingSettings).toHaveBeenCalledTimes(1);
  });
});

describe('tägliche Berliner Fälligkeit', () => {
  it('wartet bis zur lokalen Uhrzeit und wiederholt einen erfolgreichen Tag nicht', () => {
    const jetzt = new Date('2026-11-25T01:00:00Z');
    expect(taeglichFaelligAb(new Date('2026-11-24T00:59:00Z'), null, '02:00')).toBe(null);
    expect(taeglichFaelligAb(jetzt, null, '02:00')).toBe('2026-11-25');
    expect(taeglichFaelligAb(jetzt, new Date('2026-11-24T01:00:00Z'), '02:00')).toBe('2026-11-25');
    expect(taeglichFaelligAb(jetzt, jetzt, '02:00')).toBe(null);
  });

  it('verwendet bei beiden Zeitumstellungen den Berliner Kalendertag', () => {
    expect(taeglichFaelligAb(new Date('2026-03-29T00:59:00Z'), null, '03:00')).toBe(null);
    expect(taeglichFaelligAb(new Date('2026-03-29T01:00:00Z'), null, '03:00')).toBe('2026-03-29');
    expect(taeglichFaelligAb(new Date('2026-10-25T01:30:00Z'), new Date('2026-10-25T00:30:00Z'), '02:00')).toBe(null);
  });
});
