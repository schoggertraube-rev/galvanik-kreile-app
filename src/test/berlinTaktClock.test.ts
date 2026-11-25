import {describe, expect, it} from 'vitest';
import {berlinCalendarDay, berlinUhrzeit} from '@/lib/domain/workingDays';

describe('Taktzeit in Berlin', () => {
  it('überspringt die fehlende Stunde im Frühjahr', () => {
    expect(berlinUhrzeit(new Date('2026-03-29T00:59:00Z'))).toBe('01:59');
    expect(berlinUhrzeit(new Date('2026-03-29T01:00:00Z'))).toBe('03:00');
  });

  it('behält am Herbstwechsel beide Instanzen der zweiten Stunde im selben Kalendertag', () => {
    const first = new Date('2026-10-25T00:30:00Z');
    const second = new Date('2026-10-25T01:30:00Z');
    expect(berlinUhrzeit(first)).toBe('02:30');
    expect(berlinUhrzeit(second)).toBe('02:30');
    expect(berlinCalendarDay(first)).toBe(berlinCalendarDay(second));
  });
});
