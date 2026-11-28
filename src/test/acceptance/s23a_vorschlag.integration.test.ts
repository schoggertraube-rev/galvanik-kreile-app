// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {createFixture,full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {fuehreEingangVorschlagAusAction,getIntakeCaptureAction,leseEingangVorschlagAction,saveIntakeNoteAction} from '@/app/actions/eingang.actions';
import {readErkennungsEinstellungenInTransaction} from '@/modules/fundament/server-public';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';

const database=process.env.DATABASE_URL;
if(!database||database!==process.env.H18_EXPECTED_DATABASE_URL||new URL(database).hostname!=='127.0.0.1'){
 throw Error('S23A_VORSCHLAG_LOOPBACK_REQUIRED');
}

it('leitet den Kundenvorschlag aus der gespeicherten Erkennung ab und bestätigt ihn über die vorhandene Zuordnung',async()=>{
 const kundeId=await customerFixture('TEST S23a Vorschlag');
 const itemId=randomUUID();
 const quelle=await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST Bitte um Rückruf'}));
 if(quelle.code!=='OK')throw Error('TEST_S23A_NOTIZ:'+quelle.code);
 // Isolated TEST candidate just after recognition. Assignment and its receipts use the application writers.
 const grund='TEST Gleiche Mailadresse wie im Kundenstamm';
 await sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,feld,wert,sicherheit,sicherheit_wert,regel,grund,status)
  VALUES (${tenant},${itemId}::uuid,'kunde',to_jsonb(${kundeId}::text),'unsicher',0.6,'HC1',${grund},'offen')`;
 const folge=await withSession(full,()=>leseEingangVorschlagAction(itemId));
 if(folge.code!=='OK'||!folge.vorschlag.haupt)throw Error('TEST_S23A_VORSCHLAG:'+folge.code);
 expect(folge.vorschlag).toMatchObject({haupt:{grund,befehl:'assignIntakeCustomerAction',eingabe:{customerId:kundeId}},frage:null,oder:[]});
 const input={itemId,vorschlagId:folge.vorschlag.haupt.vorschlagId,clientEventId:randomUUID()};
 const ohneKunden=await createFixture(['eingang']);
 expect(await withSession(ohneKunden,()=>leseEingangVorschlagAction(itemId))).toMatchObject({code:'OK',vorschlag:{haupt:null}});
 expect(await withSession(ohneKunden,()=>fuehreEingangVorschlagAusAction(input))).toMatchObject({code:'FORBIDDEN'});
 const erledigt=await withSession(full,()=>fuehreEingangVorschlagAusAction(input));
 expect(erledigt).toMatchObject({code:'OK',vorschlag:{haupt:null},ergebnisId:expect.any(String),wiederholt:false});
 expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{customerId:kundeId,assignment:'bestaetigt'}});
 expect(await withSession(full,()=>fuehreEingangVorschlagAusAction(JSON.parse(JSON.stringify(input)))))
  .toMatchObject({code:'OK',wiederholt:true});
 expect(await withSession(full,()=>fuehreEingangVorschlagAusAction({...input,clientEventId:randomUUID()})))
  .toMatchObject({code:'CONFLICT',vorschlag:{haupt:null}});
 expect(await sql`SELECT art FROM public.intake_event WHERE tenant_id=${tenant} AND item_id=${itemId}::uuid
   AND befehl_id=${input.clientEventId}::uuid ORDER BY art`).toEqual([{art:'einsatz'},{art:'zugeordnet'}]);
});

it('liest die Vorgabe und den ausgeschalteten Wert aus den vorhandenen Firmeneinstellungen',async()=>{
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,material_aufschlag_prozent,lager_regelversion)
  VALUES (${randomUUID()},${tenant},'TEST S23a',0,'TEST-S23a')`;
 const auth=await withSession(full,resolveAuthorization);
 if(!auth.ok)throw Error('TEST_S23A_EINSTELLUNG_AUTH');
 const settings=()=>withPrivilegedTenantTransaction(auth.data,tx=>readErkennungsEinstellungenInTransaction(tx,tenant));
 expect(await settings()).toMatchObject({eingang_selbst_handeln:true});
 await sql`UPDATE public.company_settings SET eingang_selbst_handeln=false WHERE tenant_id=${tenant}`;
 expect(await settings()).toMatchObject({eingang_selbst_handeln:false});
});

it('öffnet die vorhandene KV-Vorbereitung und liest nach dem Speichern das nächste echte Anliegen',async()=>{
 const {selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
 const {createQuoteAction,prepareQuoteFromIntakeAction}=await import('@/app/actions/quotes.actions');
 const kundeId=await customerFixture('TEST S23a KV-Folge');
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,material_aufschlag_prozent,lager_regelversion)
  SELECT ${randomUUID()},${tenant},'TEST S23a KV-Folge',0,'TEST-KV' WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${tenant})`;
 const itemId=randomUUID();
 const source=await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),context:{customerId:kundeId},
  text:'TEST 4 Weber-Trompeten verchromen, ein KV in zwei Wochen. Alte Halter bitte behalten.',concerns:['aufgabe']}));
 if(source.code!=='OK')throw Error('TEST_S23A_KV_QUELLE:'+source.code);
 const chosen=await withSession(full,()=>selectIntakeConcernAction({itemId,version:source.capture.version,clientEventId:randomUUID(),concern:'kv_anfrage'}));
 if(chosen.code!=='OK')throw Error('TEST_S23A_KV_ANLIEGEN:'+chosen.code);
 const proposal=await withSession(full,()=>leseEingangVorschlagAction(itemId));
 if(proposal.code!=='OK'||!proposal.vorschlag.haupt)throw Error('TEST_S23A_KV_VORSCHLAG:'+proposal.code);
 expect(proposal.vorschlag.haupt).toMatchObject({befehl:'prepareQuoteFromIntakeAction',eingabe:{customerId:kundeId}});
 const ohnePreise=await createFixture(['eingang','kunden','auftraege']);
 expect(await withSession(ohnePreise,()=>leseEingangVorschlagAction(itemId))).toMatchObject({code:'OK',vorschlag:{haupt:null}});
 expect(await withSession(full,()=>fuehreEingangVorschlagAusAction({itemId,vorschlagId:proposal.vorschlag.haupt!.vorschlagId,clientEventId:randomUUID()})))
  .toMatchObject({code:'OK',oeffne:'kv-vorbereiten'});
 const prep=await withSession(full,()=>prepareQuoteFromIntakeAction({sourceItemId:itemId}));
 if(prep.code!=='OK')throw Error('TEST_S23A_KV_PREP:'+prep.code);
 expect(prep.preparation).toMatchObject({customer:{id:kundeId},source:{itemId,version:chosen.capture.version}});
 const input={clientEventId:randomUUID(),customerId:kundeId,dueDate:'2027-04-20',note:'TEST KV-Folge',source:prep.preparation.source,
  positions:[{name:'TEST Weber-Trompeten',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000}]};
 expect(await withSession(full,()=>createQuoteAction(input))).toMatchObject({code:'OK',quote:{lifecycle:{sourceItemId:itemId}}});
 expect(await withSession(full,()=>createQuoteAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>leseEingangVorschlagAction(itemId))).toMatchObject({code:'OK',vorschlag:{haupt:null,anliegenRest:['aufgabe'],satz:'Weiter mit Aufgabe anlegen'}});
});
