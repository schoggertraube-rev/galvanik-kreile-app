// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {sql,createFixture,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {completeIntakeTaskAction,getIntakeTaskAction,saveIntakeTaskAction} from '@/app/actions/eingang.actions';
import {pageReadQueryObservation,withPageReadBudget} from '@/db/readBudget';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {canReadTaskArea} from '@/lib/auth/authorizationContract';
import {resolveAuthorization} from '@/lib/server/authorization';
import {authorizationReadContext} from '@/lib/server/authorizationReadContext';
import {liesAufgabenFuerTag,projiziereAufgabenFuerTag} from '@/modules/tasks/server-public';
import type {TaskSaveInput} from '@/modules/tasks/public';

it('liest offene Aufgaben ohne Eingang, schützt Geld und Bezug und entfernt den erledigten Eintrag',async()=>{
 const ersteller=await createFixture(['auftraege','preise'],'buero');
 const auftraege=await createFixture(['auftraege'],'buero');
 const kunden=await createFixture(['kunden'],'buero');
 const kunde=await customerFixture('Tag Aufgabe');
 const {receipt:auftrag}=await intakeOrderFixture('Tag Aufgabe',kunde,'pickup',3);
 const faellig=berlinCalendarDay();
 const fremd=tenant+'-fremd',fremdAkteur=randomUUID(),fremdAufgabe=randomUUID();
 // Explicit synthetic data for a second TEST tenant. The own task uses the real writer below.
 await sql`INSERT INTO public.app_users(id,tenant_id,email,full_name,role,active)
  VALUES(${fremdAkteur}::uuid,${fremd},${'TEST-'+fremdAkteur+'@local.invalid'},'TEST Fremder Betrieb','buero',true)`;
 await sql`INSERT INTO public.tasks(id,tenant_id,client_key,art,titel,faellig_am,vorlauf_tage,
   fuer_bereich,bezug_typ,status,erstellt_von,version)
  VALUES(${fremdAufgabe}::uuid,${fremd},${randomUUID()}::uuid,'aufgabe','TEST Fremde Aufgabe',
    ${faellig}::date,0,'auftraege','allgemein','offen',${fremdAkteur}::uuid,1)`;
 const aufgabe:TaskSaveInput={clientKey:randomUUID(),version:0,kind:'aufgabe',title:'TEST Ware für Abholung bereitlegen',
  dueDate:faellig,time:null,forLogin:null,forArea:'auftraege',reference:{type:'auftrag',id:auftrag.orderId},note:'TEST private Aufgabennotiz'};
 const erfasst=await withSession(ersteller,()=>saveIntakeTaskAction(aufgabe));
 if(erfasst.code!=='OK')throw Error(erfasst.code);
 expect(erfasst.task.item_id).toBeNull();
 const geld=await withSession(ersteller,()=>saveIntakeTaskAction({...aufgabe,clientKey:randomUUID(),title:'TEST Preis besprechen',
  forArea:'preise',reference:{type:'allgemein',id:null}}));
 if(geld.code!=='OK')throw Error(geld.code);
 const lies=(sitzung:typeof ersteller)=>withSession(sitzung,async()=>{
  const auth=await resolveAuthorization();
  if(!auth.ok)throw Error('TEST_AUTH_FEHLT');
  return withPageReadBudget(async()=>{
   const data=await liesAufgabenFuerTag(auth.data);
   return {data,queries:pageReadQueryObservation().total};
  },5000);
 });
 const key=`tasks.aufgabe:${erfasst.task.id}`;
 const zeile={key,quelleId:'tasks.aufgabe',gegenstand:aufgabe.title,faellig,
  ziel:'aufgabe',handlung:'Aufgabe öffnen',befehl:'kreile:oeffne',
  bestand:{taskId:erfasst.task.id,arg:erfasst.task.id,version:erfasst.task.version,reference:{type:'auftrag',id:auftrag.orderId}}};
 const liste=await lies(auftraege);
 expect(liste.data).toMatchObject({code:'OK',zeilen:[zeile]});
 expect(JSON.stringify(liste)).not.toContain('TEST private Aufgabennotiz');
 expect((await lies(kunden)).data).toMatchObject({code:'OK',zeilen:[{key,ziel:'aufgabe',befehl:'kreile:oeffne',bestand:{reference:null}}]});
 const mitGeld=await lies(ersteller);
 expect(mitGeld.data).toMatchObject({code:'OK',zeilen:expect.arrayContaining([
  expect.objectContaining(zeile),expect.objectContaining({key:`tasks.aufgabe:${geld.task.id}`,gegenstand:'TEST Preis besprechen'})])});
 expect(JSON.stringify(mitGeld)).not.toContain(fremdAufgabe);
 expect(liste.queries).toBeGreaterThan(0);
 expect(mitGeld.queries).toBe(liste.queries);
 const gespeichert=await withSession(ersteller,async()=>{
  const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_AUTH_FEHLT');
  return liesAufgabenFuerTag({...authorizationReadContext(auth.data),canReadTaskArea:area=>canReadTaskArea(auth.data,area)});
 });
 const kopie:unknown=JSON.parse(JSON.stringify(gespeichert));
 const ausModell=await withSession(kunden,async()=>{
  const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_AUTH_FEHLT');
  expect(projiziereAufgabenFuerTag(auth.data,{...gespeichert,tenantId:fremd})).toEqual({code:'SOURCE_INCOMPLETE'});
  return projiziereAufgabenFuerTag(auth.data,kopie);
 });
 expect(ausModell).toMatchObject({code:'OK',zeilen:[{key,bestand:{reference:null}}]});
 expect(JSON.stringify(ausModell)).not.toContain('TEST Preis besprechen');
 expect(JSON.stringify(ausModell)).not.toContain(auftrag.orderId);
 const lesen=()=>getIntakeTaskAction({taskId:zeile.bestand.arg});
 expect(await withSession(kunden,lesen)).toMatchObject({code:'OK',canComplete:false,canOpenReference:false});
 expect(await withSession(auftraege,lesen)).toMatchObject({code:'OK',canComplete:true,canOpenReference:true});
 const erledigt=await withSession(auftraege,()=>completeIntakeTaskAction({taskId:erfasst.task.id,version:erfasst.task.version,note:null}));
 expect(erledigt).toMatchObject({code:'OK',task:{id:erfasst.task.id,status:'erledigt'}});
 expect((await lies(auftraege)).data).toEqual({code:'OK',zeilen:[]});
});
