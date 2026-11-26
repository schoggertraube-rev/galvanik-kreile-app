// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {createFixture,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {completeIntakeTaskAction,saveIntakeTaskAction} from '@/app/actions/eingang.actions';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {resolveAuthorization} from '@/lib/server/authorization';
import {liesAufgabenFuerTag} from '@/modules/tasks/server-public';
import type {TaskSaveInput} from '@/modules/tasks/public';

it('liest offene Aufgaben ohne Eingang, schützt Geld und Bezug und entfernt den erledigten Eintrag',async()=>{
 const ersteller=await createFixture(['auftraege','preise'],'buero');
 const auftraege=await createFixture(['auftraege'],'buero');
 const kunden=await createFixture(['kunden'],'buero');
 const kunde=await customerFixture('Tag Aufgabe');
 const {receipt:auftrag}=await intakeOrderFixture('Tag Aufgabe',kunde,'pickup',3);
 const faellig=berlinCalendarDay();
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
  return liesAufgabenFuerTag(auth.data);
 });
 const key=`tasks.aufgabe:${erfasst.task.id}`;
 const zeile={key,quelleId:'tasks.aufgabe',gegenstand:aufgabe.title,faellig,ziel:auftrag.orderId,befehl:'completeTask',
  bestand:{taskId:erfasst.task.id,version:erfasst.task.version,reference:{type:'auftrag',id:auftrag.orderId}}};
 const liste=await lies(auftraege);
 expect(liste).toMatchObject({code:'OK',zeilen:[zeile]});
 expect(JSON.stringify(liste)).not.toContain('TEST private Aufgabennotiz');
 expect(await lies(kunden)).toMatchObject({code:'OK',zeilen:[{key,ziel:null,befehl:null,bestand:{reference:null}}]});
 expect(await lies(ersteller)).toMatchObject({code:'OK',zeilen:expect.arrayContaining([
  expect.objectContaining(zeile),expect.objectContaining({key:`tasks.aufgabe:${geld.task.id}`,gegenstand:'TEST Preis besprechen'})])});
 const erledigt=await withSession(auftraege,()=>completeIntakeTaskAction({taskId:erfasst.task.id,version:erfasst.task.version,note:null}));
 expect(erledigt).toMatchObject({code:'OK',task:{id:erfasst.task.id,status:'erledigt'}});
 expect(await lies(auftraege)).toEqual({code:'OK',zeilen:[]});
});
