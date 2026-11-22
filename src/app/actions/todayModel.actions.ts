import 'server-only';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
import {readModelPageSettingsInTransaction} from '@/modules/fundament/server-public';
import {projectIntakeMessageSources} from '@/modules/eingang/server-public';
import {projectTaskCalendarSources,projectQuoteFollowupSources} from '@/modules/tasks/server-public';
import {maskComplaintReadResult} from '@/modules/complaints/server-public';
import type {QuoteReadback} from '@/modules/quotes/public';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {quoteOperationContext} from '@/lib/server/quoteAuthorization';
import {quoteV45Capabilities,readV45QuoteRule,v45QuoteFacts} from '@/lib/server/v45QuoteRead';
import {readTodaySourcesFromModel,readTodayModelInTransaction,todayModelRevision,modelRecord,type TodayModelReadPorts} from '@/lib/server/todayDashboard';
import {composeTodayDashboard,type TodayDashboardSources} from '@/lib/server/todayDashboard';
import {withPageReadPhase} from '@/db/readBudget';

/** The App binds the existing module projectors. No writer, session identity,
 * business lookup, second permission policy or replacement source is created. */
const ports:TodayModelReadPorts={
 liveComplaints:getComplaints,
 liveFollowups:getQuoteFollowupsForTodayAction,
 readSettings:readModelPageSettingsInTransaction,
 messages:(auth,value)=>{
  const source=modelRecord(value);if(!source)throw Error('TODAY_MODEL_MESSAGES_INVALID');
  if(source.code!=='OK'){
   if(typeof source.message!=='string')throw Error('TODAY_MODEL_MESSAGE_FAILURE_INVALID');
  }else if(!Array.isArray(source.messages)||!Array.isArray(source.captures)||!source.messages.every(row=>modelRecord(row)&&typeof row.id==='string'&&Number.isSafeInteger(row.version)))throw Error('TODAY_MODEL_MESSAGE_ROWS_INVALID');
  return projectIntakeMessageSources(auth,source as unknown as Parameters<typeof projectIntakeMessageSources>[1]);
 },
 tasks:(auth,value)=>{
  const source=modelRecord(value);
  if(!source||!['OK','SOURCE_INCOMPLETE'].includes(String(source.code))||!Array.isArray(source.rows)||!Array.isArray(source.missingTaskIds)
   ||!source.rows.every(row=>modelRecord(row)&&modelRecord(row.task)&&typeof row.task.id==='string'&&modelRecord(row.reference)))throw Error('TODAY_MODEL_TASKS_INVALID');
  return projectTaskCalendarSources(auth,source as unknown as Parameters<typeof projectTaskCalendarSources>[1]);
 },
 complaints:(auth,value)=>{
  const source=modelRecord(value);if(!source)throw Error('TODAY_MODEL_COMPLAINTS_INVALID');
  if(source.code==='OK'&&(!Array.isArray(source.complaints)||!source.complaints.every(row=>modelRecord(row)&&typeof row.id==='string')))throw Error('TODAY_MODEL_COMPLAINT_ROWS_INVALID');
  if(source.code!=='OK'&&typeof source.message!=='string')throw Error('TODAY_MODEL_COMPLAINT_FAILURE_INVALID');
  return maskComplaintReadResult(auth,source as unknown as Parameters<typeof maskComplaintReadResult>[1]);
 },
 followups:(auth,value)=>{
  if(!Array.isArray(value)||!value.every(row=>modelRecord(row)&&typeof row.id==='string'&&typeof row.title==='string'&&typeof row.quoteId==='string'&&typeof row.quoteNumber==='string'&&typeof row.customerName==='string'))throw Error('TODAY_MODEL_FOLLOWUPS_INVALID');
  return {code:'OK',tasks:projectQuoteFollowupSources(auth,value as Parameters<typeof projectQuoteFollowupSources>[1])};
 },
 quotes:(auth,value,readAt)=>{
  const source=modelRecord(value),list=modelRecord(source?.list);
  if(!source||!list||list.code!=='OK'||!Array.isArray(list.quotes)||!Array.isArray(source.cards))throw Error('TODAY_MODEL_QUOTES_INVALID');
  if(!quoteOperationContext(auth).capabilities.canReadQuote)throw Error('TODAY_MODEL_QUOTE_ACCESS_UNAVAILABLE');
  const quoteList=source.list as TodayDashboardSources['quoteList'];
  const cards=source.cards;
  const quoteReads:TodayDashboardSources['quoteReads']=list.quotes.map(candidate=>{
   const ref=modelRecord(candidate);if(!ref||typeof ref.quoteId!=='string'||!Number.isSafeInteger(ref.version))throw Error('TODAY_MODEL_QUOTE_REFERENCE_INVALID');
   const saved=modelRecord(cards.find(row=>modelRecord(row)&&row.quoteId===ref.quoteId)),read=modelRecord(saved?.read),quote=modelRecord(read?.quote);
   if(read?.code!=='OK'||quote?.quoteId!==ref.quoteId||quote?.version!==ref.version||!modelRecord(quote.lifecycle)||!Array.isArray(quote.positions))return {quoteId:ref.quoteId,read:null};
   const raw=quote as unknown as QuoteReadback;
   return {quoteId:raw.quoteId,version:raw.version,read:readV45QuoteRule(auth,raw,quoteV45Capabilities(auth)),facts:v45QuoteFacts(raw,readAt),validUntil:raw.validUntil,followupAt:raw.lifecycle?.followupAt??null};
  });
  return {quoteList,quoteReads};
 },
};

export async function readModelTodayHome(auth:AuthorizationSnapshot,readAt=new Date()){
 const result=await readTodaySourcesFromModel(auth,ports,readAt);
 if(result.code!=='OK')return result;
 const dashboard=await withPageReadPhase('today.model.compose',async()=>composeTodayDashboard(auth,result.sources,result.sources.calendar),value=>({rows:value.items.length,missing:value.orderActions?.missingOrderIds.length??0}));
 return {...result,dashboard};
}

/** Cheap conditional read: the same settings/qualification SQL, no JSON payload,
 * actor follow-up reads or dashboard composition when nothing has changed. */
export async function readTodayHomeRevision(auth:AuthorizationSnapshot){
 const {withPrivilegedTenantTransaction}=await import('@/lib/server/privilegedDb');
 const {readTodayCalendar}=await import('@/lib/today/todayDashboardPolicy');
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const settings=await ports.readSettings(tx,auth);
  if(settings.today.todayReadSource==='live')return null;
  const day=readTodayCalendar(new Date()).today,model=await readTodayModelInTransaction(tx,auth,day,true);
  if(model.code!=='OK')return null;
  const pending=model.needsRebuild||model.rows.some(row=>!row.fresh);
  return {revision:todayModelRevision(auth,model.rows,day),pending};
 });
}
