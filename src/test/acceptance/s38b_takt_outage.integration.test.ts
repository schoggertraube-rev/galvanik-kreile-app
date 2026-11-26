// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-takt-stoerung-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {sql,createFixture,withSession} from '../../../e2e/ablauf/replayHarness';
import {berlinCalendarDay,berlinUhrzeit} from '@/lib/domain/workingDays';
import {resolveAuthorization} from '@/lib/server/authorization';
import {starteTaktJobNeu} from '@/app/actions/takt.actions';
import {liesTaktAusfallZeilen} from '@/modules/takt/server-public';
import {createTaktOutageSettingsFixture} from '@/test/fixtures/taktOutageSettingsFixture';

const replayUrl=process.env.DATABASE_URL;
if (!replayUrl || replayUrl!==process.env.H18_EXPECTED_DATABASE_URL ||
    new URL(replayUrl).hostname!=='127.0.0.1') {
  throw Error('TAKT_AUSFALL_REPLAY_REQUIRED');
}

it('nutzt die echte Störung, die Systemdiagnose und eine einzige belegte Wiederaufnahme',async()=>{
  const operator=await createFixture(['wartung'],'developer');
  const other=await createFixture(['auftraege']);
  const millis=Date.now();
  const tagesbeginn=Date.parse(berlinCalendarDay(new Date(millis))+'T06:00:00Z');
  const jetzt=new Date(Math.max(millis,tagesbeginn));
  const erfolg=new Date(jetzt.getTime()-36*60*60*1000);
  const fehler=new Date(jetzt.getTime()-15*60*1000);
  const jetztTag=berlinCalendarDay(jetzt);
  const erfolgTag=berlinCalendarDay(erfolg);
  const zeit=erfolgTag.slice(8)+'.'+erfolgTag.slice(5,7)+'. '+berlinUhrzeit(erfolg);
  const key='protokoll_aufbewahrung';
  const input={schluessel:key};
  const fremd=tenant+'-fremd';
  const lies=(fixture:typeof operator)=>withSession(fixture,async()=>{
    const auth=await resolveAuthorization();
    if(!auth.ok)throw Error('TEST_TAKT_AUTH_FEHLT');
    return liesTaktAusfallZeilen(auth.data,jetzt);
  });
  const settings=createTaktOutageSettingsFixture(tenant);
  try{
    await settings.create(12);
    // Synthetic historical receipts. The restart below uses the real reservation and job writer.
    const original=randomUUID(),failed=randomUUID();
    await sql`INSERT INTO public.takt_job_runs(id,tenant_id,job_schluessel,faellig_fuer,
      gestartet_um,beendet_um,status,versuch,dauer_ms,fehlercode)
      VALUES(${original}::uuid,${tenant},${key},${erfolgTag},
        ${erfolg.toISOString()}::timestamptz-interval '1 second',${erfolg.toISOString()}::timestamptz,'ok',1,1,NULL)`;

    const protokollKey='takt.ausfall:protokoll_aufbewahrung';
    expect(await lies(operator)).toMatchObject({code:'OK',zeilen:expect.arrayContaining([
      expect.objectContaining({key:protokollKey,grund:'Letzter erfolgreicher Lauf liegt zu lange zurück'}),
    ])});
    await sql`INSERT INTO public.takt_job_runs(id,tenant_id,job_schluessel,faellig_fuer,
      gestartet_um,beendet_um,status,versuch,dauer_ms,fehlercode)
      VALUES(${failed}::uuid,${tenant},${key},${jetztTag+'T'+berlinUhrzeit(fehler)},
        ${fehler.toISOString()}::timestamptz-interval '1 second',${fehler.toISOString()}::timestamptz,'fehler',1,1,'takt_ausfuehrung')`;

    await sql`INSERT INTO public.takt_job_runs(tenant_id,job_schluessel,faellig_fuer,
      gestartet_um,beendet_um,status,versuch,dauer_ms)
      VALUES(${fremd},'heute_neuaufbau',${jetztTag},
        ${jetzt.toISOString()}::timestamptz-interval '1 second',${jetzt.toISOString()}::timestamptz,'ok',1,1)`;

    const tagKey='takt.ausfall:heute_neuaufbau';
    expect(await lies(operator)).toMatchObject({code:'OK',zeilen:expect.arrayContaining([
      expect.objectContaining({key:protokollKey,quelleId:'takt.ausfall',
        gegenstand:'Aufräumen des Protokolls ist seit '+zeit+' nicht gelaufen',
        grund:'zuletzt mit Fehler abgebrochen',handlung:'Aufräumen des Protokolls jetzt neu starten',
        befehl:'starteTaktJobNeu',bestand:input}),
      expect.objectContaining({key:tagKey,gegenstand:'Aktualisierung von „Der Tag“',grund:'noch nie gelaufen'}),
    ])});
    expect(await lies(other)).toMatchObject({code:'OK',zeilen:expect.arrayContaining([
      expect.objectContaining({key:protokollKey,befehl:null,handlung:'Nur mit Systemdiagnose'}),
    ])});
    await settings.setTolerance(48);
    expect(await lies(operator)).toMatchObject({code:'OK',zeilen:[{key:tagKey}]});
    await settings.setTolerance(12);

    vi.useFakeTimers({toFake:['Date']});
    vi.setSystemTime(jetzt);
    expect(await withSession(other,()=>starteTaktJobNeu(input))).toMatchObject({code:'FORBIDDEN'});
    expect(await withSession(operator,()=>starteTaktJobNeu({...input,tenantId:'TEST-fremd'})))
      .toEqual({code:'VALIDATION_ERROR',message:'Wähle einen hinterlegten Dienst.'});
    const results=await Promise.all([
      withSession(operator,()=>starteTaktJobNeu(input)),
      withSession(operator,()=>starteTaktJobNeu(JSON.parse(JSON.stringify(input)))),
    ]);
    expect(results.map(result=>result.code).sort()).toEqual(['CONFLICT','OK']);
    const neueLaeufe=await sql`SELECT status,versuch FROM public.takt_job_runs
      WHERE tenant_id=${tenant} AND job_schluessel=${key}
        AND id NOT IN (${original}::uuid,${failed}::uuid)`;
    expect(neueLaeufe).toEqual([{status:'ok',versuch:1}]);
    expect(await sql`SELECT job_schluessel,status,versuch FROM public.takt_job_runs WHERE tenant_id=${fremd}`)
      .toEqual([{job_schluessel:'heute_neuaufbau',status:'ok',versuch:1}]);

    expect(await lies(operator)).toMatchObject({code:'OK',zeilen:[{key:tagKey}]});
    expect(await withSession(operator,()=>starteTaktJobNeu(input)))
      .toEqual({code:'CONFLICT',message:'Für diesen Dienst steht gerade kein Neustart an.'});
  }finally{
    vi.useRealTimers();
    await settings.remove();
  }
});
