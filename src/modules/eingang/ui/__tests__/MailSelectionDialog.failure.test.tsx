// @vitest-environment jsdom
// Explicit synthetic read fixture; renders the real dialog and existing retry path.
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MailSelectionDialog,type MailSelectionPorts} from '../MailSelectionDialog';
afterEach(cleanup);
it('A2 shows the stored failed-import label and retains the existing reason/Graph-ID retry instead of adoption',async()=>{
 const message='Import fehlgeschlagen · TEST provider unavailable · TEST-Graph-ID';
 const ports:MailSelectionPorts={list:vi.fn().mockResolvedValue({code:'OK',mails:[{id:'TEST-intake',subject:'TEST Anfrage',senderName:'TEST Kunde',senderAddress:'test@example.invalid',receivedAt:null,fileCount:null,customerId:null,importFailure:{state:'FAILED',label:'Import fehlgeschlagen',reason:'TEST provider unavailable',graphMessageId:'TEST-Graph-ID',attempts:1,mailbox:'test@example.invalid',taskId:null}}]}),read:vi.fn().mockResolvedValue({code:'UNAVAILABLE',message})};
 render(<MailSelectionDialog ports={ports} target="eingang" onClose={vi.fn()}/>);
 const choose=await screen.findByRole('button',{name:/Import fehlgeschlagen · TEST Anfrage/});expect(choose).not.toHaveTextContent('0 Anhänge');fireEvent.click(choose);
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(message));
 expect(screen.queryByRole('button',{name:'Übernehmen'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Erneut'}));await waitFor(()=>expect(ports.list).toHaveBeenCalledTimes(2));
});
