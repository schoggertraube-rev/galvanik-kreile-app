// @vitest-environment node
import {expect, it, vi} from 'vitest';
vi.mock('../laeufe', () => ({beendeLauf: vi.fn(), loescheAlteLaeufe: vi.fn(), reserviereLauf: vi.fn()}));
vi.mock('@/lib/server/privilegedDb', () => ({withTaktStatementTimeout: (_fristMs: number, work: () => Promise<unknown>) => work()}));
import {liesFaelligeJobs, nachholMinuteBerlin} from '../lauf';
import {naechsteReservierung} from '../wiederholung';
import type {TaktJob} from '../../public';

it('prüft jeden Job in Registerfolge anhand seines eigenen Erfolgs', async () => {
  const now = new Date('2026-11-25T05:00:00Z');
  const jobs = ['a', 'b'].map(schluessel => ({
    schluessel, paket: null, fristMs: 25_000,
    faellig: (_jetzt: Date, letzterOk: Date | null) => letzterOk ? null : '2026-11-25',
    ausfuehren: async () => 'ok' as const,
  })) satisfies TaktJob[];
  const gelesen: string[] = [];
  const result = await liesFaelligeJobs(jobs, now, async schluessel => {
    gelesen.push(schluessel);
    return schluessel === 'a' ? now : null;
  });
  expect(gelesen).toEqual(['a', 'b']);
  expect(result).toEqual([{job: jobs[1], faelligFuer: '2026-11-25'}]);
});

it('bindet Nachholen an die Berliner Minute und deren Sommerzeitwechsel', () => {
  expect(nachholMinuteBerlin(new Date('2026-11-25T05:02:05Z'))).toBe('2026-11-25T06:02');
  expect(nachholMinuteBerlin(new Date('2026-11-25T05:02:59Z'))).toBe('2026-11-25T06:02');
  expect(nachholMinuteBerlin(new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-25T02:30');
  expect(nachholMinuteBerlin(new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-25T02:30');
});

it('legt für dieselbe Fälligkeit nur die drei freigegebenen Wiederholungen fest', () => {
  const beendet = new Date('2026-11-25T05:00:00Z');
  expect([1, 2, 3, 4].map(versuch => naechsteReservierung(versuch, beendet)?.toISOString() ?? null)).toEqual([
    '2026-11-25T05:01:00.000Z',
    '2026-11-25T05:05:00.000Z',
    '2026-11-25T05:15:00.000Z',
    null,
  ]);
  expect(naechsteReservierung(0, beendet)).toBe(null);
});
