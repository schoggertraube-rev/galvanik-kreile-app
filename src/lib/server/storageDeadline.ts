import 'server-only';
import { berlinCalendarDay, plusWorkingDays } from '@/lib/domain/workingDays';
import type { DispatchPolicy } from '@/modules/fundament/public';

/** The promise belongs to this original, never to later company settings. */
export function freezeStorageDeadline(policy: DispatchPolicy | null | undefined, date = berlinCalendarDay()) {
  const days = policy?.finalStageAfterLetterDays;
  const due = days == null ? null : plusWorkingDays(date, days, policy!.holidays);
  if (days != null && !due) throw Error('STORAGE_ORIGINAL_CALENDAR_INVALID');
  return { date, due };
}
