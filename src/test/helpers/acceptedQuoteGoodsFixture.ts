import {randomUUID} from 'node:crypto';
import type postgres from 'postgres';

/** Synthetic historical preconditions for legacy conversion tests only.
 * New acceptance/receipt Actions are verified separately against Replay.
 * Never imports this helper into a product path or changes another fixture's quote. */
export async function seedAcceptedQuoteGoodsForTest(db:postgres.Sql,input:{tenantId:string;actorId:string;quoteId:string}){
 if(process.env.NODE_ENV!=='test'||!['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL??'').hostname))throw Error('LOCAL_TEST_FIXTURE_REQUIRED');
 const id=randomUUID(),itemId=randomUUID();
 await db.begin(async tx=>{
  const rows=await tx<{customer_id:string;fassung:number;created_by:string}[]>`SELECT customer_id,fassung,created_by::text FROM private.quotes WHERE tenant_id=${input.tenantId} AND id=${input.quoteId}::uuid AND linked_order_id IS NULL FOR UPDATE`;
  if(rows.length!==1||rows[0].created_by!==input.actorId)throw Error('OWN_NEW_TEST_QUOTE_REQUIRED');
  const quote=rows[0];
  await tx`UPDATE private.quotes SET gesendet_fassung=fassung,gesendet_am=created_at,gesendet_kanal='druck',zugesagt_fassung=fassung,zugesagt_am=created_at,zusage_nachweis='SYNTHETISCH historische aktuelle Zusage' WHERE tenant_id=${input.tenantId} AND id=${input.quoteId}::uuid`;
  await tx`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,kunde_id,zuordnung,vorgang_art,vorgang_id,einsatz,text) VALUES(${itemId}::uuid,${input.tenantId},${itemId},'notiz','rein','app',${input.actorId}::uuid,${quote.customer_id},'hand','kv',${input.quoteId},'erledigt','SYNTHETISCH vorhandene angenommene Ware')`;
  await tx`INSERT INTO public.goods_receipt(id,tenant_id,client_key,item_id,auftrag_id,kv_id,kv_fassung,lagerort,modus,status,karte,packstuecke_da,packstuecke_gesamt,zustand,abweichung,abgestellt,fund_zeit,verfahren_wie_kv,fotos,mengen,offen,bestaetigt_von,bestaetigt_am) SELECT ${id}::uuid,quote.tenant_id,${id}::uuid,${itemId}::uuid,NULL,quote.id,quote.fassung,'SYNTHETISCH E1','erfassung','angenommen',1,1,1,'unauffaellig','{}',false,NULL,'stimmt','[]'::jsonb,(SELECT jsonb_agg(jsonb_build_object('teil_id',position.id::text,'kv_position',position.position,'erwartet',position.quantity,'bestaetigt',position.quantity,'geaendert',false,'hinweis',NULL) ORDER BY position.position) FROM private.quote_positions position WHERE position.tenant_id=quote.tenant_id AND position.quote_id=quote.id AND position.revision=quote.version),'{}',${input.actorId}::uuid,statement_timestamp() FROM private.quotes quote WHERE quote.tenant_id=${input.tenantId} AND quote.id=${input.quoteId}::uuid`;
 });
 return id;
}
