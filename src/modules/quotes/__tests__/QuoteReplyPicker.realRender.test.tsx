import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {QuoteReplyPicker,type QuoteReplyPickerPorts} from '../ui/QuoteReplyPicker';
beforeEach(()=>vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const targets=Array.from({length:4},(_,index)=>({id:'TEST-'+index,number:'KV-2026-000'+(index+1),customer:'TEST Kunde',parts:'TEST Teil '+index}));
function setup(text:string|null){const read:QuoteReplyPickerPorts['read']=async()=>({code:'OK',source:{id:'TEST-source',text,customer:'TEST Kunde'},targets,limited:false}),onQuote=vi.fn();render(<QuoteReplyPicker ports={{read}} onQuote={onQuote} onClose={vi.fn()} onAssign={vi.fn()}/>);return onQuote;}
it('offers at most three real candidates, names the limit and never silently chooses',async()=>{
 const onQuote=setup('TEST Antwort ohne KV-Nummer');await screen.findByText('4 KVs in der Auswahl · bitte Nummer oder Teil eingrenzen.');
 expect(screen.getAllByRole('button',{name:/KV-2026-/})).toHaveLength(3);expect(onQuote).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('KV-Nummer oder Teil eingrenzen'),{target:{value:'0004'}});
 fireEvent.click(screen.getByRole('button',{name:/KV-2026-0004/}));expect(onQuote).toHaveBeenCalledWith('TEST-3');
});
it('does not fall back to a different quote when the actual message names an unavailable number',async()=>{
 const onQuote=setup('TEST Zusage zu KV-2026-9999');await screen.findByText('Kein passender KV in der gelesenen Auswahl.');
 fireEvent.change(screen.getByLabelText('KV-Nummer oder Teil eingrenzen'),{target:{value:'0001'}});
 expect(screen.queryAllByRole('button',{name:/KV-2026-/})).toHaveLength(0);expect(onQuote).not.toHaveBeenCalled();
});
