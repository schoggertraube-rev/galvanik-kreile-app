import 'server-only';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,resolveAuthorization,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {quoteCommandContext} from '@/lib/server/quoteAuthorization';
import type {CustomerStoredProfile} from '@/modules/customers/public';
import {EINGANG_VORSCHLAG_COPY as copy} from '@/ui/eingangCopy';
import {EINGANG_FOLGEN} from '../folgen';
import {CONCERN_OPTIONS} from '../concernMenuContract';
import {assignInTransaction,canAssignIntakeCustomer,intakeAssignmentFailure,lockIntakeAssignment,
  readIntakeAssignmentSource,readIntakeCustomerSuggestions} from './intakeAssignment';

type KundeLesen=(tx:PrivilegedTenantTransaction,tenant:string,id:string)=>Promise<CustomerStoredProfile|null>;
type Eingang=Awaited<ReturnType<typeof readIntakeAssignmentSource>>;
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const folge=EINGANG_FOLGEN.kundenZuordnung;
const kv=EINGANG_FOLGEN.kvVorbereiten;

function zuordnung(eingang:Eingang,kunde:CustomerStoredProfile,grund:string,mode:'confirm'|'manual') {
  const eingabe={itemId:eingang.id,version:eingang.version,customerId:kunde.id,mode};
  const vorschlagId=createHash('sha256').update(JSON.stringify([eingang.id,folge.schluessel,eingabe])).digest('hex');
  return {vorschlagId,schluessel:folge.schluessel,befehl:folge.befehl,knopf:folge.knopf,satz:folge.satz(kunde.name),
    grund,kunde:kunde.name,eingabe};
}

function kvVorbereitung(eingang:Eingang,kunde:CustomerStoredProfile) {
  const eingabe={itemId:eingang.id,version:eingang.version,customerId:kunde.id};
  const vorschlagId=createHash('sha256').update(JSON.stringify([eingang.id,kv.schluessel,eingabe])).digest('hex');
  return {vorschlagId,schluessel:kv.schluessel,befehl:kv.befehl,knopf:kv.knopf,satz:kv.satz(kunde.name),
    grund:kv.knopf,kunde:kunde.name,eingabe};
}

type Vorschlag=ReturnType<typeof zuordnung>|ReturnType<typeof kvVorbereitung>;

async function bildeVorschlag(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,eingang:Eingang,leseKunde:KundeLesen) {
  const basis={satz:null as string|null,haupt:null as Vorschlag|null,oder:[],anliegenRest:eingang.anliegen_offen,frage:null as
    {satz:string;kandidaten:ReturnType<typeof zuordnung>[]} | null};
  if(eingang.einsatz==='erledigt'&&eingang.anliegen_offen.length===0)return {...basis,satz:copy.fertig};
  if(eingang.einsatz!=='offen')return basis;
  if(eingang.kunde_id&&!eingang.vorgang_id&&eingang.anliegen_offen.includes('kv_anfrage')&&eingang.text?.trim()&&eingang.text.length<=6000&&
    quoteCommandContext(auth).capabilities.canCreateQuote&&(hasAuthorizationArea(auth,'mails')||eingang.erstellt_von===auth.userId)){
    const kunde=await leseKunde(tx,auth.tenantId,eingang.kunde_id);
    if(kunde){const haupt=kvVorbereitung(eingang,kunde);return {...basis,satz:haupt.satz,haupt};}
  }
  if(eingang.vorgang_art==='kv'){
    const weiter=CONCERN_OPTIONS.find(option=>option.concern===eingang.anliegen_offen[0]);
    if(weiter)return {...basis,satz:copy.weiterMit(weiter.text)};
  }
  if(eingang.zuordnung!=='offen'||!canAssignIntakeCustomer(auth)||!hasAuthorizationArea(auth,folge.recht))return basis;
  const kandidaten=await readIntakeCustomerSuggestions(tx,auth,eingang.id);
  const ids=new Set(kandidaten.flatMap(row=>typeof row.wert==='string'?[row.wert]:[]));
  const mode=ids.size===1?'confirm':'manual';
  const optionen=await Promise.all([...ids].slice(0,3).map(async id=>{
    const grund=kandidaten.find(row=>row.wert===id&&row.grund?.trim())?.grund;
    const kunde=grund?await leseKunde(tx,auth.tenantId,id):null;
    return kunde&&grund?zuordnung(eingang,kunde,grund,mode):null;
  }));
  const wahl=optionen.filter(option=>option!==null);
  return ids.size===1&&wahl[0]?{...basis,satz:wahl[0].satz,haupt:wahl[0]}:{...basis,frage:{satz:copy.vonWem,kandidaten:wahl}};
}

function darfLesen(auth:AuthorizationSnapshot,eingang:Eingang) {
  return eingang.kanal!=='mail'||hasAuthorizationArea(auth,'mails');
}

export async function leseEingangVorschlag(itemId:unknown,leseKunde:KundeLesen) {
  if(!uuid(itemId))return {code:'VALIDATION_ERROR' as const,message:copy.ungueltig};
  const auth=await resolveAuthorization();
  if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:auth.message};
  if(!hasAuthorizationArea(auth.data,'eingang'))return {code:'FORBIDDEN' as const,message:copy.recht};
  try{
    return await withPrivilegedTenantTransaction(auth.data,async tx=>{
      const eingang=await readIntakeAssignmentSource(tx,auth.data,itemId);
      if(!darfLesen(auth.data,eingang))return {code:'FORBIDDEN' as const,message:copy.recht};
      return {code:'OK' as const,vorschlag:await bildeVorschlag(tx,auth.data,eingang,leseKunde)};
    });
  }catch(error){return intakeAssignmentFailure(error);}
}

export async function fuehreEingangVorschlagAus(input:unknown,leseKunde:KundeLesen) {
  if(!input||typeof input!=='object'||Object.keys(input).sort().join(',')!=='clientEventId,itemId,vorschlagId'
    ||!('itemId' in input)||!uuid(input.itemId)||!('clientEventId'in input)||!uuid(input.clientEventId)
    ||!('vorschlagId'in input)||typeof input.vorschlagId!=='string'||!/^[a-f0-9]{64}$/.test(input.vorschlagId)) {
    return {code:'VALIDATION_ERROR' as const,message:copy.ungueltig};
  }
  const {itemId,clientEventId,vorschlagId}=input;
  const session=await resolveAuthorization();
  if(!session.ok)return {code:'UNAUTHENTICATED' as const,message:session.message};
  const auth=session.data;
  if(!hasAuthorizationArea(auth,'eingang')||(!(canAssignIntakeCustomer(auth)&&hasAuthorizationArea(auth,folge.recht))&&
    !quoteCommandContext(auth).capabilities.canCreateQuote))return {code:'FORBIDDEN' as const,message:copy.recht};
  try{
    return await withPrivilegedTenantTransaction(auth,async tx=>{
      await lockIntakeAssignment(tx,auth.tenantId);
      const eingang=await readIntakeAssignmentSource(tx,auth,itemId,true);
      if(!darfLesen(auth,eingang))return {code:'FORBIDDEN' as const,message:copy.recht};
      const vorschlag=await bildeVorschlag(tx,auth,eingang,leseKunde);
      const konflikt={code:'CONFLICT' as const,message:copy.veraltet,vorschlag};
      const vorher=await tx.execute<{von:string;vorschlagId:string|null;ergebnisId:string|null}>(sql`
        SELECT einsatz.von,einsatz.nachher->>'vorschlagId' AS "vorschlagId",wirkung.id::text AS "ergebnisId"
        FROM public.intake_event einsatz LEFT JOIN public.intake_event wirkung
          ON wirkung.tenant_id=einsatz.tenant_id AND wirkung.item_id=einsatz.item_id AND wirkung.art='zugeordnet'
          AND wirkung.von=einsatz.von AND wirkung.befehl_id=einsatz.befehl_id AND wirkung.id::text=einsatz.nachher->>'ergebnisId'
        WHERE einsatz.tenant_id=${auth.tenantId} AND einsatz.item_id=${itemId}::uuid AND einsatz.art='einsatz'
          AND einsatz.befehl_id=${clientEventId}::uuid`);
      if(vorher.length){
        const [beleg]=vorher;
        return vorher.length===1&&beleg.von===auth.userId&&beleg.vorschlagId===vorschlagId&&beleg.ergebnisId?
          {code:'OK' as const,vorschlag,ergebnisId:beleg.ergebnisId,wiederholt:true}:konflikt;
      }
      const auswahl=vorschlag.haupt?.vorschlagId===vorschlagId?vorschlag.haupt:
        vorschlag.frage?.kandidaten.find(kandidat=>kandidat.vorschlagId===vorschlagId);
      if(!auswahl)return konflikt;
      if(auswahl.schluessel===kv.schluessel)return {code:'OK' as const,vorschlag,oeffne:'kv-vorbereiten' as const};
      const ergebnis=await assignInTransaction(tx,auth,{...auswahl.eingabe,clientEventId},leseKunde);
      if(ergebnis.code!=='OK')return konflikt;
      const quittung=await tx.execute<{nachher:{ergebnisId:string}}>(sql`
        INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
        SELECT ${auth.tenantId},${itemId}::uuid,'einsatz',${clientEventId}::uuid,${auth.userId},
          jsonb_build_object('schluessel',${folge.schluessel}::text,'vorschlagId',${vorschlagId}::text,'ergebnisId',wirkung.id::text)
        FROM public.intake_event wirkung WHERE wirkung.tenant_id=${auth.tenantId} AND wirkung.item_id=${itemId}::uuid
          AND wirkung.art='zugeordnet' AND wirkung.befehl_id=${clientEventId}::uuid AND wirkung.von=${auth.userId}
        RETURNING nachher`);
      if(quittung.length!==1)throw Error('INTAKE_VORSCHLAG_QUITTUNG_FEHLT');
      const nachher=await readIntakeAssignmentSource(tx,auth,itemId);
      return {code:'OK' as const,vorschlag:await bildeVorschlag(tx,auth,nachher,leseKunde),ergebnisId:quittung[0].nachher.ergebnisId,wiederholt:false};
    });
  }catch(error){return intakeAssignmentFailure(error);}
}
