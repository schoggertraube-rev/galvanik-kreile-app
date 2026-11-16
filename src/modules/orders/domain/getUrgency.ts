import { berlinCalendarDay } from '@/lib/domain/workingDays';

export type Urgency = "kritisch" | "gefaehrdet" | "im_plan" | "unknown";

export function getUrgency(dueDate: Date | string | null | undefined, now = new Date()): Urgency {
  if (dueDate === null || dueDate === undefined || (typeof dueDate === "string" && !dueDate.trim())) return "unknown";

  const due = new Date(dueDate);
  if (isNaN(due.getTime()) || isNaN(now.getTime())) return "unknown";

  // Compare Berlin calendar labels. UTC is only the ordinal representation
  // of those labels, never the day of either original timestamp (DST-safe).
  const today = Date.parse(berlinCalendarDay(now) + 'T00:00:00Z');
  const tomorrow = today + 86_400_000;
  const dueDay = Date.parse(berlinCalendarDay(due) + 'T00:00:00Z');

  if (dueDay < today) {
    return "kritisch";
  } else if (dueDay <= tomorrow) {
    return "gefaehrdet";
  } else {
    return "im_plan";
  }
}
