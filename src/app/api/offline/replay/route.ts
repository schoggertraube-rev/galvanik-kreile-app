import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {isPendingWorkshopOriginal} from '@/lib/offline/pendingStore';

const LIMIT=64*1024;
const headers={'cache-control':'no-store',vary:'Cookie, Origin, Sec-Fetch-Site'};
const failure=(code:string,status:number)=>Response.json({code},{status,headers});
/** PL13Nov13:29: transport only, never another writer or actor. */
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')!=='same-origin')return failure('FORBIDDEN',403);
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return failure('VALIDATION_ERROR',400);
 const length=request.headers.get('content-length');if(length!==null&&Number(length)>LIMIT)return failure('PAYLOAD_TOO_LARGE',413);
 let text='';
 if(!request.body)return failure('VALIDATION_ERROR',400);
 const reader=request.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0;
 try{
  for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>LIMIT){await reader.cancel();return failure('PAYLOAD_TOO_LARGE',413);}text+=decoder.decode(part.value,{stream:true});}
  text+=decoder.decode();
 }catch{return failure('VALIDATION_ERROR',400);}finally{reader.releaseLock();}
 let input:unknown;try{input=JSON.parse(text);}catch{return failure('VALIDATION_ERROR',400);}
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='original,scope'||!('scope' in input)||typeof input.scope!=='string'||!('original' in input)||!isPendingWorkshopOriginal(input.original))return failure('VALIDATION_ERROR',400);
 const result=await replayOfflineWorkshopAction(input.scope,input.original);
 const status=result.code==='OK'||result.code==='PRESERVED'?200:result.code==='UNAUTHENTICATED'?401:result.code==='FORBIDDEN'?403:result.code==='VALIDATION_ERROR'?400:result.code==='CONFLICT'?409:503;
 return Response.json(result,{status,headers});
}
