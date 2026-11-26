const DAY_MS = 86_400_000;
const FIRST_DAY = Date.UTC(100, 0, 1) / DAY_MS;

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

export function leseBetriebsruhetage(wert: unknown): ReadonlySet<string> | null {
  if (!Array.isArray(wert)) return null;
  const zeitraeume: { von: number; bis: number }[] = [];
  for (const eintrag of wert) {
    if (typeof eintrag !== "object" || eintrag === null
      || typeof eintrag.von !== "string" || typeof eintrag.bis !== "string") return null;
    const von = parseDay(eintrag.von);
    const bis = parseDay(eintrag.bis);
    if (!von || !bis || eintrag.von > eintrag.bis) return null;
    zeitraeume.push({ von: ordinal(von), bis: ordinal(bis) });
  }

  const tage = new Set<string>();
  let letztesEnde = FIRST_DAY - 1;
  for (const { von, bis } of zeitraeume.sort((links, rechts) => links.von - rechts.von)) {
    for (let tag = Math.max(von, letztesEnde + 1); tag <= bis; tag += 1) {
      tage.add(formatDay(fromOrdinal(tag)));
    }
    letztesEnde = Math.max(letztesEnde, bis);
  }
  return tage;
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

export function plusWorkingDays(value: string, count: number, additionalHolidays: readonly string[] = []): string | null {
  const day = parseDay(value);
  if (!day || !Number.isSafeInteger(count) || count < 0 || !Array.isArray(additionalHolidays) || !additionalHolidays.every(value=>typeof value==='string'&&parseDay(value)!==null)) return null;
  const closedDays=new Set(additionalHolidays);
  const working=(value:string)=>isWorkingDay(value)&&!closedDays.has(value);
  let current = ordinal(day);
  if (count === 0) {
    while (!working(formatDay(fromOrdinal(current)))) current += 1;
    return formatDay(fromOrdinal(current));
  }
  let remaining = count;
  while (remaining > 0) {
    current += 1;
    if (working(formatDay(fromOrdinal(current)))) remaining -= 1;
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

export function workingDaysBetween(from: string, to: string, additionalHolidays: readonly string[] = []): number | null {
  const fromDay = parseDay(from);
  const toDay = parseDay(to);
  if (!fromDay || !toDay || !Array.isArray(additionalHolidays) || !additionalHolidays.every(value=>typeof value==='string'&&parseDay(value)!==null)) return null;
  const closedDays=new Set(additionalHolidays);
  const start = ordinal(fromDay);
  const end = ordinal(toDay);
  if (start === end) return 0;
  if (end < start) {
    const reverse = workingDaysBetween(to, from,additionalHolidays);
    return reverse === null ? null : -reverse;
  }
  let total = 0;
  for (let current = start + 1; current <= end; current += 1) {
    const value=formatDay(fromOrdinal(current));
    if (isWorkingDay(value)&&!closedDays.has(value)) total += 1;
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

/** Clock time in Berlin, including the daylight-saving transition. */
export function berlinUhrzeit(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("hour")}:${read("minute")}`;
}

/** One due key per Berlin calendar day, including either DST transition. */
export function taeglichFaelligAb(jetzt: Date, letzterOk: Date | null, uhrzeit: '02:00' | '03:00'): string | null {
  if (berlinUhrzeit(jetzt) < uhrzeit) return null;
  const tag = berlinCalendarDay(jetzt);
  return letzterOk !== null && berlinCalendarDay(letzterOk) === tag ? null : tag;
}
