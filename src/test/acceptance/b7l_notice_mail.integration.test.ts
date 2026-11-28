// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {createFixture,full,nativeFetch,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {
  readGoodsOutNoticeMailEvent,readQueuedMailSentEvent,sendGoodsOutNoticeMail,
} from '@/lib/server/communicationPort';

it('bindet den Bescheid an die gebuchte Herausgabe und quittiert ihn mit einem anderen Mail-Login',async()=>{
  const order=await readyOrderForInvoice('TEST B7L Abholbescheid','pickup');
  const release=await withSession(full,()=>recordGoodsOutAction({
    orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:randomUUID(),
  }));
  if(release.code!=='OK')throw Error('TEST_B7L_RELEASE_REQUIRED');
  const next=await createFixture(['mails']);
  const denied=await createFixture(['auftraege']);
  async function readAuth(){
    const auth=await resolveAuthorization();
    if(!auth.ok)throw Error('TEST_B7L_LOGIN_REQUIRED');
    return auth.data;
  }
  const firstAuth=await withSession(full,readAuth);
  const nextAuth=await withSession(next,readAuth);
  const deniedAuth=await withSession(denied,readAuth);
  const [{email}]=await sql`SELECT email FROM public.customers WHERE tenant_id=${tenant} AND id=${order.customerId}`;
  const source={orderId:order.orderId,goodsOutEventId:release.receipt.eventId,kind:'abholbescheid' as const};
  const notice={...source,subject:'TEST Abholbescheid',body:'TEST Die Ware wurde abgeholt.'};
  let sends=0;
  let requestId='';

  // Only the external provider is doubled. The first physical send loses its HTTP response.
  const graph=vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
    const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
    if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-b7l-token'.repeat(4),expires_in:3600});
    if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){
      sends++;
      const body=JSON.parse(String(init?.body)) as {message:{internetMessageHeaders:{name:string;value:string}[]}};
      requestId=body.message.internetMessageHeaders.find(header=>header.name.toLowerCase()==='x-kreile-request-id')?.value??'';
      throw Error('TEST B7L accepted, response lost');
    }
    if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[{
      id:'TEST-B7L-Sent',internetMessageId:'<TEST-B7L@example.invalid>',
      from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:email}}],
      isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:requestId}],
    }]});
    return nativeFetch(request,init);
  });
  try{
    expect(await sendGoodsOutNoticeMail(deniedAuth,notice)).toMatchObject({code:'FORBIDDEN'});
    expect(await sendGoodsOutNoticeMail(firstAuth,{...notice,goodsOutEventId:randomUUID()})).toMatchObject({code:'NOT_FOUND'});
    expect(await sendGoodsOutNoticeMail(firstAuth,{...notice,kind:'versandbescheid'})).toMatchObject({code:'NOT_FOUND'});
    expect(sends).toBe(0);
    expect(await sendGoodsOutNoticeMail(firstAuth,notice)).toMatchObject({code:'UNAVAILABLE'});
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await sql`SELECT station FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`).toEqual([{station:'abgeholt'}]);

    const recovery=await sendGoodsOutNoticeMail(nextAuth,structuredClone(notice));
    expect(recovery).toMatchObject({code:'OK',data:{orderId:order.orderId,replayed:true}});
    if(recovery.code!=='OK')throw Error('TEST_B7L_OUTGOING_PROOF_REQUIRED');
    const {threadId,messageId,mailEventId}=recovery.data;
    const receipt={threadId,messageId};
    expect(await readGoodsOutNoticeMailEvent(nextAuth,source,receipt)).toBe(mailEventId);
    expect(await readGoodsOutNoticeMailEvent(deniedAuth,source,receipt)).toBeNull();
    expect(await readGoodsOutNoticeMailEvent(nextAuth,source,{...receipt,messageId:randomUUID()})).toBeNull();
    expect(await readGoodsOutNoticeMailEvent(nextAuth,{...source,orderId:randomUUID()},receipt)).toBeNull();
    expect(await readQueuedMailSentEvent(firstAuth,requestId,receipt)).toBe(mailEventId);
    expect(await readQueuedMailSentEvent(nextAuth,requestId,receipt)).toBeNull();
    expect(await sendGoodsOutNoticeMail(nextAuth,notice)).toEqual(recovery);
    expect(sends).toBe(1);
    expect(await sql`SELECT user_id::text AS sender,payload->>'clickedBy' AS retried_by
      FROM public.events WHERE tenant_id=${tenant} AND id=${mailEventId}`).toEqual([{sender:full.actorId,retried_by:next.actorId}]);
  }finally{
    graph.mockRestore();
  }
});
