import {expect,vi} from 'vitest';
import {nativeFetch} from './replayHarness';

/** Only Microsoft's HTTP boundary is doubled; MIME import, Storage and document matching remain real. */
export function installQuoteReplyProvider(input:{graphId:string;internetId:string;sentId:string;sentInternetId:string;sender:string;pdfBase64:string}){
 const text='TEST Ich bestätige den Kostenvoranschlag und erteile den Auftrag.';
 const mime=Buffer.from('Message-ID: '+input.internetId+'\r\nIn-Reply-To: '+input.sentInternetId+'\r\nFrom: '+input.sender+'\r\nSubject: TEST KV Zusage\r\n\r\n'+text);
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-provider-reply-token'.repeat(3)});
  if(url.hostname!=='graph.microsoft.com')return nativeFetch(request,init);
  if(url.pathname.endsWith('/mailFolders/sentitems/messages')){
   expect(url.searchParams.get('$filter')).toBe("internetMessageId eq '"+input.sentInternetId+"'");
   return Response.json({value:[{id:input.sentId,internetMessageId:input.sentInternetId,isDraft:false,sentDateTime:'2026-11-09T12:01:00Z',from:{emailAddress:{address:'TEST-mailbox@example.invalid'}},toRecipients:[{emailAddress:{address:input.sender}}],hasAttachments:true}]});
  }
  if(url.pathname.includes('/messages/'+encodeURIComponent(input.sentId)+'/attachments'))return Response.json({value:[{id:'TEST-sent-pdf',name:'TEST-KV.pdf',contentType:'application/pdf',contentBytes:input.pdfBase64,'@odata.type':'#microsoft.graph.fileAttachment',isInline:false}]});
  if(url.pathname.endsWith('/messages/'+encodeURIComponent(input.graphId)+'/$value'))return new Response(mime.toString('utf8'));
  if(url.pathname.endsWith('/messages/'+encodeURIComponent(input.graphId)+'/attachments'))return Response.json({value:[]});
  if(!url.pathname.endsWith('/messages/'+encodeURIComponent(input.graphId)))throw Error('TEST_UNEXPECTED_GRAPH_PATH:'+url.pathname);
  return Response.json({id:input.graphId,internetMessageId:input.internetId,subject:'TEST KV Zusage',from:{emailAddress:{name:'TEST Kunde',address:input.sender}},receivedDateTime:'2026-11-09T12:02:00Z',bodyPreview:text,body:{contentType:'text',content:text},hasAttachments:false});
 });
}
