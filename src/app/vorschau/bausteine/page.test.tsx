// Explicit isolated server-boundary probes; not an Auth/DB or browser proof.
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {APP_ROLES,canInspectComponentPreview} from '@/lib/auth/authorizationContract';
const probes=vi.hoisted(()=>({auth:vi.fn(),card:vi.fn(),customer:vi.fn(),quote:vi.fn(),capture:vi.fn(),master:vi.fn()}));
vi.mock('next/navigation',()=>({notFound:()=>{throw Error('TEST_NEXT_NOT_FOUND');}}));
vi.mock('@/app/actions/auth.actions',()=>({getAuthBootstrapAction:probes.auth}));
vi.mock('@/app/actions/orders.actions',()=>({getLiveOrderCardAction:probes.card,getExtraWorkMasterDataAction:probes.master}));
vi.mock('@/app/actions/customers.actions',()=>({getCustomerSummaryAction:probes.customer}));
vi.mock('@/app/actions/quotes.actions',()=>({readQuoteAction:probes.quote}));
vi.mock('@/app/actions/eingang.actions',()=>({getIntakeCaptureAction:probes.capture}));
vi.mock('@/modules/fundament/public',()=>({ComponentPreviewFrame:()=>null}));
vi.mock('./ComponentPreview',()=>({ComponentPreview:()=>null}));
import ComponentPreviewPage from './page';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('VERCEL_ENV','preview');});
afterEach(()=>vi.unstubAllEnvs());
const source=()=>({searchParams:Promise.resolve({auftrag:'TEST-order',kv:'TEST-quote',eingang:'TEST-capture'})});
it('rejects every employee role before any business source is read, even with the flag enabled',async()=>{
 for(const role of APP_ROLES.filter(role=>role!=='developer')){
  expect(canInspectComponentPreview({role})).toBe(false);
  expect(canInspectComponentPreview({role,areas:['wartung']})).toBe(false);
  probes.auth.mockResolvedValue({status:'authenticated',user:{role,packageSwitches:{ui_v45:true}}});
  await expect(ComponentPreviewPage(source())).rejects.toThrow('TEST_NEXT_NOT_FOUND');
 }
 for(const reader of [probes.card,probes.customer,probes.quote,probes.capture,probes.master])expect(reader).not.toHaveBeenCalled();
});
it('keeps the authenticated developer behind the same flag and production boundary',async()=>{
 expect(canInspectComponentPreview({role:'developer'})).toBe(true);
 probes.auth.mockResolvedValue({status:'authenticated',user:{role:'developer',packageSwitches:{ui_v45:false}}});
 await expect(ComponentPreviewPage(source())).rejects.toThrow('TEST_NEXT_NOT_FOUND');
 probes.auth.mockResolvedValue({status:'unauthenticated'});
 await expect(ComponentPreviewPage(source())).rejects.toThrow('TEST_NEXT_NOT_FOUND');
 vi.stubEnv('VERCEL_ENV','production');
 await expect(ComponentPreviewPage(source())).rejects.toThrow('TEST_NEXT_NOT_FOUND');
 expect(probes.card).not.toHaveBeenCalled();
});
it('preserves the existing forbidden read as a missing source without granting developer business rights',async()=>{
 probes.auth.mockResolvedValue({status:'authenticated',user:{role:'developer',packageSwitches:{ui_v45:true}}});
 probes.card.mockResolvedValue({code:'FORBIDDEN',message:'TEST canonical source denied'});
 const page=await ComponentPreviewPage(source());
 expect(page).toBeTruthy();expect(probes.card).toHaveBeenCalledExactlyOnceWith({orderId:'TEST-order'});
 for(const reader of [probes.customer,probes.quote,probes.capture,probes.master])expect(reader).not.toHaveBeenCalled();
});
