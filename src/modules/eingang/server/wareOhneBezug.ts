import 'server-only';

import {isDeepStrictEqual} from 'node:util';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,resolveAuthorization,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {readGoodsReceiptOrder} from '@/lib/server/goodsReceiptOrderPort';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {WARE_OHNE_BEZUG_COPY as copy} from '@/ui/eingangCopy';
import {mayUseContinuationSources} from './intakeContinuationAccess';
import {gespeichertesBelegoriginal} from './intakeOriginal';
import {bindIntakeOriginalToOrder} from './intakeOrderBinding';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
type Ablegen={itemId:string;version:number;befehlId:string;ort:string};
type Verknuepfen={goodsReceiptId:string;version:number;befehlId:string;auftragId:string};
type Paket={id:string;itemId:string;ort:string;auftragId:string|null;version:number;verknuepftAm:string|null};
type Fehler={code:'VALIDATION_ERROR'|'NOT_FOUND'|'FORBIDDEN'|'UNAUTHENTICATED'|'CONFLICT'|'UNAVAILABLE';message:string};
type Ergebnis=Fehler|{code:'OK';paket:Paket;wiederholt:boolean};

const paketSpalten=sql`id::text,item_id::text AS "itemId",lagerort AS ort,auftrag_id AS "auftragId",version,verknuepft_am::text AS "verknuepftAm"`;
const erfolgreich=(paket:Paket,wiederholt=false):Ergebnis=>({code:'OK',paket,wiederholt});
const konflikt=(message:string=copy.geaendert):Fehler=>({code:'CONFLICT',message});

function anfrage(wert:unknown){
 if(!wert||typeof wert!=='object'||Array.isArray(wert))return null;
 const input=wert as Record<string,unknown>;
 return typeof input.befehlId==='string'&&uuid.test(input.befehlId)
  &&typeof input.version==='number'&&Number.isSafeInteger(input.version)&&input.version>0?input:null;
}

async function mitEingang(arbeit:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot)=>Promise<Ergebnis>):Promise<Ergebnis>{
 const session=await resolveAuthorization();
 if(!session.ok)return {code:'UNAUTHENTICATED',message:copy.sitzung};
 if(!hasAuthorizationArea(session.data,'eingang'))return {code:'FORBIDDEN',message:copy.recht};
 try{return await withPrivilegedTenantTransaction(session.data,tx=>arbeit(tx,session.data));}
 catch(error){
  const grund=error instanceof Error&&error.cause?error.cause:error;
  if(typeof grund==='object'&&grund!==null&&'code'in grund&&grund.code==='23505')return konflikt();
  if(error instanceof Error&&error.message==='INTAKE_CAPTURE_FORBIDDEN')return {code:'FORBIDDEN',message:copy.recht};
  if(error instanceof Error&&['INTAKE_CAPTURE_CUSTOMER_CONFLICT','INTAKE_CAPTURE_ALREADY_ASSIGNED','INTAKE_CAPTURE_ASSIGNMENT_CONFLICT'].includes(error.message))return konflikt();
  console.error('[WARE_OHNE_BEZUG_SPEICHERN_FEHLGESCHLAGEN]');
  return {code:'UNAVAILABLE',message:copy.speichern};
 }
}

async function wiederholung(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,itemId:string,befehlId:string,absicht:unknown){
 const zeilen=await tx.execute<{von:string;nachher:{absicht?:unknown;paket?:Paket}}>(sql`
  SELECT von,nachher FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${itemId}::uuid
   AND art='ware' AND befehl_id=${befehlId}::uuid`);
 if(!zeilen.length)return null;
 const [beleg]=zeilen;
 const paket=beleg.nachher.paket;
 return zeilen.length===1&&beleg.von===auth.userId&&isDeepStrictEqual(beleg.nachher.absicht,absicht)
  &&paket?.itemId===itemId&&typeof paket.ort==='string'&&uuid.test(paket.id)?erfolgreich(paket,true):konflikt();
}

export async function legePaketOhneBezugAb(wert:unknown):Promise<Ergebnis>{
 const input=anfrage(wert);
 if(!input||typeof input.itemId!=='string'||!uuid.test(input.itemId)||typeof input.ort!=='string'||
  !input.ort.trim()||input.ort.trim().length>120)return {code:'VALIDATION_ERROR',message:copy.ablagesort};
 const {itemId,version,befehlId,ort}=input as Ablegen;
 const ablage=ort.trim(),absicht={aktion:'ware.ohne_bezug_ablegen',itemId,version,ort:ablage};
 return mitEingang(async(tx,auth)=>{
  const [eingang]=await tx.execute<{version:number;vorgangId:string|null;anliegen:string[];kanal:string;erstelltVon:string;
   fortsetzungVon:string|null;handArt:string|null;hatOriginal:boolean}>(sql`
   SELECT eingang.version,eingang.vorgang_id AS "vorgangId",eingang.anliegen,eingang.kanal,
    eingang.erstellt_von::text AS "erstelltVon",eingang.fortsetzung_von::text AS "fortsetzungVon",
    (SELECT s.wert #>> '{}' FROM public.intake_suggestion s WHERE s.tenant_id=eingang.tenant_id AND s.item_id=eingang.id
      AND s.feld='art' AND s.status='uebernommen' ORDER BY s.id LIMIT 1) AS "handArt",
    EXISTS(SELECT 1 FROM public.intake_file file WHERE file.tenant_id=eingang.tenant_id AND file.item_id=eingang.id
      AND ${gespeichertesBelegoriginal}) AS "hatOriginal"
   FROM public.intake_item eingang WHERE eingang.tenant_id=${auth.tenantId} AND eingang.id=${itemId}::uuid
    AND eingang.aussortiert IS NULL FOR UPDATE OF eingang`);
  if(!eingang)return {code:'NOT_FOUND',message:copy.eingangFehlt};
  if((eingang.kanal==='mail'||eingang.erstelltVon!==auth.userId)&&!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN',message:copy.recht};
  if(eingang.fortsetzungVon&&!await mayUseContinuationSources(tx,auth,itemId))return {code:'FORBIDDEN',message:copy.recht};
  const replay=await wiederholung(tx,auth,itemId,befehlId,absicht);if(replay)return replay;
  if(eingang.vorgangId)return konflikt(copy.schonZugeordnet);
  const istWare=eingang.handArt!==null?eingang.handArt==='ware'
   :eingang.anliegen.some(art=>art==='ware'||art==='ware_ohne_bezug');
  if(eingang.version!==version||!eingang.hatOriginal||!istWare)return konflikt();
  const [gespeichert]=await tx.execute<Paket&{belegt:boolean}>(sql`
   WITH stand AS (
    UPDATE public.intake_item SET anliegen=CASE WHEN 'ware_ohne_bezug'=ANY(anliegen) THEN anliegen ELSE array_append(anliegen,'ware_ohne_bezug') END,
      anliegen_offen=CASE WHEN 'ware_ohne_bezug'=ANY(anliegen_offen) THEN anliegen_offen ELSE array_append(anliegen_offen,'ware_ohne_bezug') END,
      version=version+1,geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp()
    WHERE tenant_id=${auth.tenantId} AND id=${itemId}::uuid AND version=${version}
     AND NOT EXISTS(SELECT 1 FROM public.goods_receipt WHERE tenant_id=${auth.tenantId} AND item_id=${itemId}::uuid AND modus='ohne_bezug')
    RETURNING id
   ), aufgegeben AS (
    INSERT INTO public.goods_receipt(id,tenant_id,client_key,item_id,modus,status,lagerort,karte,abgestellt,fotos,mengen,offen)
    SELECT ${befehlId}::uuid,${auth.tenantId},${befehlId}::uuid,stand.id,'ohne_bezug','entwurf',${ablage},0,false,'[]'::jsonb,'[]'::jsonb,'{}'::text[]
    FROM stand RETURNING ${paketSpalten}
   ), beleg AS (
    INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
    SELECT ${auth.tenantId},paket."itemId"::uuid,'ware',${befehlId}::uuid,${auth.userId},
      jsonb_build_object('absicht',${JSON.stringify(absicht)}::jsonb,'paket',to_jsonb(paket))
    FROM aufgegeben paket RETURNING id
   ) SELECT aufgegeben.*,EXISTS(SELECT 1 FROM beleg) AS belegt FROM aufgegeben`);
  if(!gespeichert)return konflikt();
  const {belegt,...paket}=gespeichert;
  if(!belegt)throw Error('WARE_OHNE_BEZUG_BELEG_FEHLT');
  return erfolgreich(paket);
 });
}

export async function verknuepfePaketOhneBezug(wert:unknown):Promise<Ergebnis>{
 const input=anfrage(wert);
 if(!input||typeof input.goodsReceiptId!=='string'||!uuid.test(input.goodsReceiptId)||
  typeof input.auftragId!=='string'||!input.auftragId.trim()||input.auftragId.length>128)return {code:'VALIDATION_ERROR',message:copy.auftragFehlt};
 const {goodsReceiptId,auftragId,version,befehlId}=input as Verknuepfen;
 const absicht={aktion:'ware.paket_verknuepfen',goodsReceiptId,auftragId,version};
 return mitEingang(async(tx,auth)=>{
  const [vorher]=await tx.execute<Paket>(sql`SELECT ${paketSpalten} FROM public.goods_receipt
   WHERE tenant_id=${auth.tenantId} AND id=${goodsReceiptId}::uuid AND modus='ohne_bezug' FOR UPDATE`);
  if(!vorher)return {code:'NOT_FOUND',message:copy.eingangFehlt};
  const replay=await wiederholung(tx,auth,vorher.itemId,befehlId,absicht);if(replay)return replay;
  if(vorher.auftragId)return konflikt(copy.schonZugeordnet);
  if(vorher.version!==version)return konflikt();
  const auftrag=await readGoodsReceiptOrder(tx,auth,auftragId);
  if(!auftrag||['storniert','abgebrochen'].includes(auftrag.status)||['abgeholt','abgebrochen'].includes(auftrag.station))
   return {code:'VALIDATION_ERROR',message:copy.auftragFehlt};
  await bindIntakeOriginalToOrder(tx,auth,{itemId:vorher.itemId,orderId:auftrag.id,customerId:auftrag.customerId,
   clientEventId:befehlId,complete:false});
  const [gespeichert]=await tx.execute<Paket&{belegt:boolean}>(sql`
   WITH verknuepft AS (
    UPDATE public.goods_receipt SET auftrag_id=${auftrag.id},verknuepft_am=statement_timestamp(),
     version=version+1,geaendert_am=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${goodsReceiptId}::uuid
      AND version=${version} AND auftrag_id IS NULL RETURNING ${paketSpalten}
   ), beleg AS (
    INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
    SELECT ${auth.tenantId},paket."itemId"::uuid,'ware',${befehlId}::uuid,${auth.userId},
      jsonb_build_object('absicht',${JSON.stringify(absicht)}::jsonb,'paket',to_jsonb(paket))
    FROM verknuepft paket RETURNING id
   ) SELECT verknuepft.*,EXISTS(SELECT 1 FROM beleg) AS belegt FROM verknuepft`);
  if(!gespeichert)throw Error('INTAKE_CAPTURE_ASSIGNMENT_CONFLICT');
  const {belegt,...paket}=gespeichert;
  if(!belegt)throw Error('WARE_OHNE_BEZUG_BELEG_FEHLT');
  return erfolgreich(paket);
 });
}
