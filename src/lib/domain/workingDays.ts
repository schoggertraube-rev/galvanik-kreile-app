const DAY_MS = 86_400_000;

type CalendarDay = { year: number; month: number; day: number };

function parseDay(value: string): CalendarDay | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

function formatDay(value: CalendarDay): string {
  return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function ordinal(value: CalendarDay): number {
  return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / DAY_MS);
}

function fromOrdinal(value: number): CalendarDay {
  const date = new Date(value * DAY_MS);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function easterSunday(year: number): CalendarDay {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

function nationwideGermanHolidays(year: number): Set<number> {
  const easter = ordinal(easterSunday(year));
  return new Set([
    ordinal({ year, month: 1, day: 1 }),
    easter - 2,
    easter + 1,
    ordinal({ year, month: 5, day: 1 }),
    easter + 39,
    easter + 50,
    ordinal({ year, month: 10, day: 3 }),
    ordinal({ year, month: 12, day: 25 }),
    ordinal({ year, month: 12, day: 26 }),
  ]);
}

export function isWorkingDay(value: string): boolean {
  const day = parseDay(value);
  if (!day) return false;
  const dayOrdinal = ordinal(day);
  const weekday = new Date(dayOrdinal * DAY_MS).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !nationwideGermanHolidays(day.year).has(dayOrdinal);
}

export function plusWorkingDays(value: string, count: number): string | null {
  const day = parseDay(value);
  if (!day || !Number.isSafeInteger(count) || count < 0) return null;
  let current = ordinal(day);
  if (count === 0) {
    while (!isWorkingDay(formatDay(fromOrdinal(current)))) current += 1;
    return formatDay(fromOrdinal(current));
  }
  let remaining = count;
  while (remaining > 0) {
    current += 1;
    if (isWorkingDay(formatDay(fromOrdinal(current)))) remaining -= 1;
  }
  return formatDay(fromOrdinal(current));
}

export function previousWorkingDay(value: string): string | null {
  const day = parseDay(value);
  if (!day) return null;
  let current = ordinal(day);
  while (!isWorkingDay(formatDay(fromOrdinal(current)))) current -= 1;
  return formatDay(fromOrdinal(current));
}

export function workingDaysBetween(from: string, to: string): number | null {
  const fromDay = parseDay(from);
  const toDay = parseDay(to);
  if (!fromDay || !toDay) return null;
  const start = ordinal(fromDay);
  const end = ordinal(toDay);
  if (start === end) return 0;
  if (end < start) {
    const reverse = workingDaysBetween(to, from);
    return reverse === null ? null : -reverse;
  }
  let total = 0;
  for (let current = start + 1; current <= end; current += 1) {
    if (isWorkingDay(formatDay(fromOrdinal(current)))) total += 1;
  }
  return total;
}

export function berlinCalendarDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}
