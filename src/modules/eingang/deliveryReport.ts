import {createHash} from 'node:crypto';

export type DeliveryReport={source:'original_mime';originalSha256:string;status:'failed'|'other'|'invalid';recipient:string|null;originalMessageId:string|null};
const messageId=/^<[^<>\s]{1,998}>$/;
function headers(text:string){
 if(text.length>65536)throw Error('DSN_HEADERS_TOO_LARGE');
 const result=new Map<string,string>();
 for(const line of text.replace(/\r?\n[ \t]+/g,' ').split(/\r?\n/)){
  if(!line)continue;const colon=line.indexOf(':');if(colon<1)throw Error('DSN_HEADER_INVALID');
  const name=line.slice(0,colon).toLowerCase(),value=line.slice(colon+1).trim();
  if(result.has(name)){
   if(['content-type','content-transfer-encoding','message-id','final-recipient','action','status','reporting-mta'].includes(name))throw Error('DSN_HEADER_AMBIGUOUS');
  }else result.set(name,value);
 }
 return result;
}
function entity(text:string){const end=text.search(/\r?\n\r?\n/);if(end<0)throw Error('DSN_ENTITY_INVALID');const separator=text.slice(end).match(/^\r?\n\r?\n/)![0];return {headers:headers(text.slice(0,end)),body:text.slice(end+separator.length)};}
function decoded(body:string,encoding:string|undefined){
 if(!encoding||/^(?:7bit|8bit|binary)$/i.test(encoding))return body;
 if(encoding.toLowerCase()==='base64'){
  const value=body.replace(/\s/g,'');if(!value||value.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('DSN_BASE64_INVALID');
  return Buffer.from(value,'base64').toString('latin1');
 }
 if(encoding.toLowerCase()==='quoted-printable')return body.replace(/=\r?\n/g,'').replace(/=([a-f\d]{2})/gi,(_,hex:string)=>String.fromCharCode(parseInt(hex,16)));
 throw Error('DSN_ENCODING_UNSUPPORTED');
}
/** Conservative RFC3464 classification from the secured MIME bytes, never the human subject. */
export function deliveryReportFromOriginal(bytes:Uint8Array):DeliveryReport|null{
 const originalSha256=createHash('sha256').update(bytes).digest('hex');
 const base:DeliveryReport={source:'original_mime',originalSha256,status:'invalid',recipient:null,originalMessageId:null};
 const text=Buffer.from(bytes).toString('latin1'),headerEnd=text.search(/\r?\n\r?\n/);
 if(headerEnd<0)return null;
 // Ordinary mail remains ordinary mail, even if its subject says "Undeliverable".
 if(!/^content-type:\s*multipart\/report\b/im.test(text.slice(0,headerEnd)))return null;
 try{
  if(bytes.length>2*1024*1024)throw Error('DSN_REPORT_TOO_LARGE');
  const root=entity(text),contentType=root.headers.get('content-type')??'';
  if((contentType.match(/;\s*report-type\s*=/gi)??[]).length!==1||(contentType.match(/;\s*boundary\s*=/gi)??[]).length!==1||!/;\s*report-type\s*=\s*(?:"delivery-status"|delivery-status)(?:\s*;|\s*$)/i.test(contentType))throw Error('DSN_REPORT_TYPE_INVALID');
  const match=contentType.match(/;\s*boundary\s*=\s*(?:"([^"\r\n]{1,70})"|([^\s;]{1,70}))/i),boundary=match?.[1]??match?.[2];
  if(!boundary)throw Error('DSN_BOUNDARY_MISSING');
  const parts:string[]=[];let current:string[]|null=null,closed=false;
  for(const line of root.body.split(/\r?\n/)){
   if(line.trimEnd()==='--'+boundary||line.trimEnd()==='--'+boundary+'--'){
    if(current)parts.push(current.join('\r\n'));
    if(line.trimEnd()==='--'+boundary+'--'){closed=true;break;}current=[];
   }else if(current)current.push(line);
  }
  if(!closed||parts.length<2||parts.length>20)throw Error('DSN_PARTS_INVALID');
  const entities=parts.map(entity),statusParts=entities.filter(part=>/^message\/delivery-status(?:\s*;|\s*$)/i.test(part.headers.get('content-type')??''));
  const originals=entities.filter(part=>/^(?:message\/rfc822|text\/rfc822-headers)(?:\s*;|\s*$)/i.test(part.headers.get('content-type')??''));
  if(statusParts.length!==1||originals.length!==1)throw Error('DSN_PROOF_AMBIGUOUS');
  const statusPart=statusParts[0],blocks=decoded(statusPart.body,statusPart.headers.get('content-transfer-encoding')).trim().split(/\r?\n\r?\n/).map(headers);
  if(blocks.length!==2||!blocks[0].has('reporting-mta'))throw Error('DSN_RECIPIENT_AMBIGUOUS');
  const recipient=blocks[1].get('final-recipient')?.match(/^rfc822\s*;\s*([^\s<>]+@[^\s<>]+)$/i)?.[1].toLowerCase();
  const action=blocks[1].get('action')?.toLowerCase(),status=blocks[1].get('status');
  if(!recipient||!action||!status||!/^\d\.\d{1,3}\.\d{1,3}$/.test(status))throw Error('DSN_RECIPIENT_INVALID');
  const original=originals[0],originalText=decoded(original.body,original.headers.get('content-transfer-encoding'));
  const originalHeaders=headers(originalText.split(/\r?\n\r?\n/)[0]),id=originalHeaders.get('message-id');
  if(!id||!messageId.test(id))throw Error('DSN_ORIGINAL_ID_INVALID');
  if(action==='failed'&&!status.startsWith('5.'))throw Error('DSN_STATUS_CONTRADICTION');
  if(action==='delayed'&&!status.startsWith('4.')||['delivered','relayed','expanded'].includes(action)&&!status.startsWith('2.'))throw Error('DSN_STATUS_CONTRADICTION');
  if(!['failed','delayed','delivered','relayed','expanded'].includes(action))throw Error('DSN_ACTION_INVALID');
  return {...base,status:action==='failed'?'failed':'other',recipient,originalMessageId:id};
 }catch(error){console.warn('[DSN_ORIGINAL_NOT_QUALIFIED]',error instanceof Error?error.message:'UnknownError');return base;}
}
