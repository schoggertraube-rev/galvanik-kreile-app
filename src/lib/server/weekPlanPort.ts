import 'server-only';

import {sql} from 'drizzle-orm';
import {isWorkingDay} from '@/lib/domain/workingDays';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';

const isoWocheMuster = /^([1-9]\d{3})-W(0[1-9]|[1-4]\d|5[0-3])$/u;

type Wochenplan = Readonly<{
  woche: string;
  personen: readonly Readonly<{
    id: string;
    rolle: string;
    arbeitstage: readonly string[];
    abwesenheiten: readonly unknown[];
  }>[];
  abwesenheitQuelle: 'fehlt' | 'kalender';
}>;

function tageDerWoche(isoWoche: string): string[] {
  const teile = isoWocheMuster.exec(isoWoche);
  if (!teile) throw Error('WEEK_PLAN_WEEK_INVALID');

  const jahr = Number(teile[1]);
  const woche = Number(teile[2]);
  const vierterJanuar = new Date(Date.UTC(jahr, 0, 4));
  const januarWochentag = (vierterJanuar.getUTCDay() + 6) % 7;
  const montag = 4 - januarWochentag + (woche - 1) * 7;
  if (new Date(Date.UTC(jahr, 0, montag + 3)).getUTCFullYear() !== jahr) {
    throw Error('WEEK_PLAN_WEEK_INVALID');
  }
  return Array.from({length: 7}, (_, tag) => new Date(Date.UTC(jahr, 0, montag + tag)).toISOString().slice(0, 10));
}

/** D7 reads the operating calendar and active people for one explicit tenant. */
export async function readWeekPlan(tenantId: string, isoWeek: string): Promise<Wochenplan> {
  const kalenderwoche = tageDerWoche(isoWeek);
  return withPrivilegedTenantTransaction({tenantId}, async tx => {
    const kalender = await tx.execute<{betriebsruhe: string[]}>(sql`
      SELECT CASE WHEN firma.id IS NULL THEN private.s16d_spur_d_standardwerte()->'betriebsruhe'
        ELSE firma.betriebsruhe END AS betriebsruhe
      FROM (VALUES (1)) AS start(zeile)
      LEFT JOIN public.company_settings firma ON firma.tenant_id=${tenantId}
      WHERE current_setting('app.tenant_id',true)=${tenantId}
      LIMIT 2`);
    if (kalender.length !== 1 || !Array.isArray(kalender[0].betriebsruhe)) {
      throw Error('WEEK_PLAN_CLOSURES_UNAVAILABLE');
    }
    const geschlossen = new Set(kalender[0].betriebsruhe);
    const arbeitstage = kalenderwoche.filter(datum => isWorkingDay(datum) && !geschlossen.has(datum));
    const personen = await tx.execute<{id: string; rolle: string}>(sql`
      SELECT id::text,role AS rolle FROM public.app_users
      WHERE tenant_id=${tenantId} AND active=true ORDER BY id`);
    return {
      woche: isoWeek,
      personen: personen.map(person => ({...person, arbeitstage, abwesenheiten: []})),
      abwesenheitQuelle: 'fehlt',
    };
  });
}
