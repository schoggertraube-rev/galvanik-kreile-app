// @vitest-environment jsdom
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {OriginalDialog,type OriginalPorts} from '../OriginalDialog';

afterEach(cleanup);

describe('Original: O07 metadata without Mails',()=>{
 it('shows the restricted original without asking the forbidden content reader or exposing download actions',async()=>{
  const capture=vi.fn<OriginalPorts['capture']>().mockResolvedValue({code:'FORBIDDEN',message:'Mails nicht freigegeben.'});
  const ports:OriginalPorts={open:vi.fn().mockResolvedValue({code:'OK',original:{id:'11111111-1111-4111-8111-111111111111',itemId:'22222222-2222-4222-8222-222222222222',name:'synthetic.eml',mime:'message/rfc822',bytes:90,sha256:'a'.repeat(64),customerId:null,orderId:null,previewable:false,url:null,downloadUrl:null,restricted:true}}),capture,confirm:vi.fn(),retry:vi.fn()};
  render(<OriginalDialog fileId="11111111-1111-4111-8111-111111111111" ports={ports} onClose={vi.fn()} onAssign={vi.fn()} onMessage={vi.fn()}/>);
  await waitFor(()=>expect(screen.getByText('synthetic.eml',{selector:'strong'})).toBeTruthy());
  expect(screen.getAllByText('Mail · Inhalt nur fürs Büro').length).toBeGreaterThan(0);
  expect(screen.getByText('SHA-256 '+'a'.repeat(64))).toBeTruthy();
  expect(capture).not.toHaveBeenCalled();
  expect(screen.queryByRole('link',{name:'Herunterladen'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Am Original geprüft'})).toBeNull();
  expect(screen.queryByText(/Original nicht ladbar/)).toBeNull();
 });
});
