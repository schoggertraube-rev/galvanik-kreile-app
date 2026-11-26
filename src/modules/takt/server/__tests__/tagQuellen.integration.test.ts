// @vitest-environment node
import {expect,it,vi} from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-takt-stoerung-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({KREILE_TENANT_SLUG: tenant}));

import {sql,createFixture,withSession} from '../../../../../e2e/ablauf/replayHarness';
import {createTaktOutageSettingsFixture} from '@/test/fixtures/taktOutageSettingsFixture';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {resolveAuthorization} from '@/lib/server/authorization';
import {starteTaktJobNeu} from '@/app/actions/takt.actions';
import {beendeLauf,reserviereLauf} from '../laeufe';
import {nachholMinuteBerlin} from '../lauf';
import {liesTaktAusfallFakten,liesTaktAusfallZeilen} from '../tagQuellen';

const replayUrl = process.env.DATABASE_URL;
if (!replayUrl || replayUrl !== process.env.H18_EXPECTED_DATABASE_URL ||
    new URL(replayUrl).hostname !== '127.0.0.1') {
  throw Error('TAKT_AUSFALL_REPLAY_REQUIRED');
}

it('nutzt die echte Störung, die Systemdiagnose und eine einzige belegte Wiederaufnahme', async () => {
  const operator = await createFixture(['wartung'],'developer');
  const other = await createFixture(['auftraege']);
  const millis = Date.now();
  const nachTagesbeginn = Date.parse(berlinCalendarDay(new Date(millis)) + 'T06:00:00Z');
  const jetzt = new Date(Math.max(millis,nachTagesbeginn));
  const oldFinish = new Date(jetzt.getTime() - 36 * 60 * 60 * 1000);
  const key = 'protokoll_aufbewahrung';
  const input = {schluessel:key};
  const liesZeilen = (fixture: typeof operator) => withSession(fixture, async () => {
    const auth=await resolveAuthorization();
    if(!auth.ok)throw Error('TEST_TAKT_AUTH_FEHLT');
    return liesTaktAusfallZeilen(auth.data,jetzt);
  });

  const settings = createTaktOutageSettingsFixture(tenant);
  try {
    await settings.create(12);
    const original = await reserviereLauf(tenant,key,berlinCalendarDay(oldFinish),2000);
    if (!original) throw Error('TEST_TAKT_ALTLAUF_FEHLT');
    await beendeLauf(tenant,original,'ok',1);
    // Datierter TEST-Altbestand, dessen Lauf über den echten Writer aufgezeichnet wurde.
    await sql`UPDATE public.takt_job_runs
      SET gestartet_um=${oldFinish.toISOString()}::timestamptz-interval '1 second',beendet_um=${oldFinish.toISOString()}::timestamptz
      WHERE tenant_id=${tenant} AND id=${original.id}::uuid`;
    const failedKey = nachholMinuteBerlin(new Date(jetzt.getTime()-15*60*1000));
    const failed = await reserviereLauf(tenant,key,failedKey,2000);
    if (!failed) throw Error('TEST_TAKT_FEHLVERSUCH_FEHLT');
    await beendeLauf(tenant,failed,'fehler',1,'takt_ausfuehrung');

    const before = await liesTaktAusfallFakten({tenantId:tenant},jetzt);
    expect(before).toMatchObject({code:'OK',ausfaelle:expect.arrayContaining([
      expect.objectContaining({laufstand:expect.objectContaining({schluessel:key,letzterErfolgMs:oldFinish.getTime(),letzterAbschluss:'fehler'})}),
      expect.objectContaining({laufstand:expect.objectContaining({schluessel:'heute_neuaufbau',letzterErfolgMs:null})}),
    ])});
    const zeilen=await liesZeilen(operator);
    expect(zeilen).toMatchObject({code:'OK',zeilen:expect.arrayContaining([
      expect.objectContaining({key:'takt.ausfall:protokoll_aufbewahrung',quelleId:'takt.ausfall',
        gegenstand:expect.stringMatching(/^Aufräumen des Protokolls ist seit \d{2}\.\d{2}\. \d{2}:\d{2} nicht gelaufen$/u),
        grund:'zuletzt mit Fehler abgebrochen',handlung:'Aufräumen des Protokolls jetzt neu starten',
        befehl:'starteTaktJobNeu',bestand:input}),
      expect.objectContaining({key:'takt.ausfall:heute_neuaufbau',
        gegenstand:'Aktualisierung von „Der Tag“',grund:'noch nie gelaufen'}),
    ])});
    expect(await liesZeilen(other)).toMatchObject({code:'OK',zeilen:expect.arrayContaining([
      expect.objectContaining({key:'takt.ausfall:protokoll_aufbewahrung',befehl:null,handlung:''}),
    ])});
    await settings.setTolerance(48);
    expect(await liesTaktAusfallFakten({tenantId:tenant},jetzt)).toMatchObject({code:'OK',ausfaelle:[
      {laufstand:{schluessel:'heute_neuaufbau'}},
    ]});
    await settings.setTolerance(12);

    vi.useFakeTimers({toFake:['Date']});
    vi.setSystemTime(jetzt);
    expect(await withSession(other,()=>starteTaktJobNeu(input))).toMatchObject({code:'FORBIDDEN'});
    expect(await withSession(operator,()=>starteTaktJobNeu({...input,tenantId:'TEST-fremd'}))).toEqual({code:'VALIDATION_ERROR'});
    const results = await Promise.all([
      withSession(operator,()=>starteTaktJobNeu(input)),
      withSession(operator,()=>starteTaktJobNeu(JSON.parse(JSON.stringify(input)))),
    ]);
    expect(results.map(result=>result.code).sort()).toEqual(['CONFLICT','OK']);
    expect(await sql`SELECT status,versuch FROM public.takt_job_runs
      WHERE tenant_id=${tenant} AND job_schluessel=${key} AND faellig_fuer=${nachholMinuteBerlin(jetzt)}`)
      .toEqual([{status:'ok',versuch:1}]);

    expect(await liesTaktAusfallFakten({tenantId:tenant},jetzt)).toMatchObject({code:'OK',ausfaelle:[
      {laufstand:{schluessel:'heute_neuaufbau'}},
    ]});
    expect(await liesZeilen(operator)).toMatchObject({code:'OK',zeilen:[
      {key:'takt.ausfall:heute_neuaufbau'},
    ]});
    expect(await withSession(operator,()=>starteTaktJobNeu(input))).toEqual({code:'CONFLICT'});
  } finally {
    vi.useRealTimers();
    await sql`DELETE FROM public.takt_job_runs WHERE tenant_id=${tenant}`;
    await settings.remove();
  }
});
