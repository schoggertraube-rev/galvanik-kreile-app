import {vi} from 'vitest';
import {nativeFetch} from './replayHarness';

export function installMailProvider(graphId:string,text:string,sender:string,subject='TEST Abholwunsch'){
 const internetId='<'+graphId+'@example.invalid>';
 const mime=Buffer.from('Message-ID: '+internetId+'\r\nFrom: '+sender+'\r\nSubject: '+subject+'\r\n\r\n'+text);
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-ablauf-provider-token'.repeat(3)});
  if(url.hostname==='graph.microsoft.com'){
   if(url.pathname.endsWith('/$value'))return new Response(mime.toString('utf8'));
   if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
   return Response.json({id:graphId,internetMessageId:internetId,subject,from:{emailAddress:{name:'TEST Kunde',address:sender}},receivedDateTime:'2026-11-09T12:00:00Z',bodyPreview:text,body:{contentType:'text',content:text},hasAttachments:false});
  }
  return nativeFetch(input,init);
 });
}
