import {notFound} from 'next/navigation';
import {ComponentPreviewFrame} from '@/modules/fundament/public';
import {getAuthBootstrapAction} from '@/app/actions/auth.actions';
import {getLiveOrderCardAction,getExtraWorkMasterDataAction} from '@/app/actions/orders.actions';
import {getCustomerSummaryAction} from '@/app/actions/customers.actions';
import {readQuoteAction} from '@/app/actions/quotes.actions';
import {getIntakeCaptureAction} from '@/app/actions/eingang.actions';
import {componentPreviewEnvironmentAllowed} from '@/lib/domain/componentPreviewEnvironment';
import {COMPONENT_PREVIEW_COPY as COPY} from '@/ui/situationCatalog';
import {ComponentPreview} from './ComponentPreview';

export const dynamic='force-dynamic';
/** A read-only component page, not another scenario store or business writer. */
export default async function ComponentPreviewPage({searchParams}:{searchParams:Promise<{auftrag?:string;kv?:string;eingang?:string}>}){
 if(!componentPreviewEnvironmentAllowed({deployment:process.env.VERCEL_ENV,node:process.env.NODE_ENV,database:process.env.DATABASE_URL}))notFound();
 const auth=await getAuthBootstrapAction();
 if(auth.status!=='authenticated'||auth.user.packageSwitches?.ui_v45!==true)notFound();
 const input=await searchParams;
 const source=typeof input.auftrag==='string'&&input.auftrag.length>0&&input.auftrag.length<=128
  ?await getLiveOrderCardAction({orderId:input.auftrag}):null;
 const quoteId=typeof input.kv==='string'&&input.kv.length>0&&input.kv.length<=128?input.kv:source?.code==='OK'?source.data.card.commercialQuote?.quoteId:null;
 const [customer,quote,capture,master]=source?.code==='OK'?await Promise.all([
  getCustomerSummaryAction({customerId:source.data.card.customerId}),
  quoteId?readQuoteAction({quoteId,purpose:'operations'}):Promise.resolve(null),
  typeof input.eingang==='string'&&input.eingang.length>0&&input.eingang.length<=128?getIntakeCaptureAction(input.eingang):Promise.resolve(null),
  getExtraWorkMasterDataAction(),
 ]):[null,null,null,null];
 return <ComponentPreviewFrame role={auth.user.role}>
  {source?.code==='OK'?<ComponentPreview key={source.data.card.id+':'+(capture?.code==='OK'?capture.capture.id:'')} source={source.data} customer={customer} quote={quote} capture={capture} master={master}/>:<p role="status">{source===null?COPY.missing:COPY.unavailable}</p>}
 </ComponentPreviewFrame>;
}
