import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {RueckgaengigLeiste,type RueckgaengigLeisteProps} from './RueckgaengigLeiste';
import {PENDING_UNDO_COPY as COPY} from '@/ui/situationCatalog';
afterEach(cleanup);
const now=Date.parse('2026-11-20T04:00:00.000Z');
const props=():RueckgaengigLeisteProps=>({eintraege:[{id:'TEST-N5-A',text:'TEST Teil A fertig melden',frist:new Date(now+10000).toISOString(),gestartet:false}],jetzt:now,beschaeftigtId:null,quelleUnbekannt:false,fehler:null,onRueckgaengig:vi.fn()});
it('keeps the original key through expiry and enables no withdrawal after the deadline or a real claim',()=>{
 const p=props(),view=render(<RueckgaengigLeiste {...p}/>);
 expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','10');
 fireEvent.click(screen.getByRole('button',{name:p.eintraege[0].text+' · '+COPY.undo}));expect(p.onRueckgaengig).toHaveBeenCalledWith('TEST-N5-A');
 view.rerender(<RueckgaengigLeiste {...p} jetzt={now+4000}/>);expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','6');
 view.rerender(<RueckgaengigLeiste {...p} jetzt={now+10000}/>);expect(screen.getByRole('button')).toBeDisabled();
 expect(screen.getByText(p.eintraege[0].text)).toBeVisible();expect(screen.queryByRole('progressbar')).toBeNull();
 view.rerender(<RueckgaengigLeiste {...p} eintraege={[{...p.eintraege[0],gestartet:true}]}/>);expect(screen.getByRole('button')).toBeDisabled();
});
it('stacks every original, preserves identity when reordered, and never treats a failed read as an empty queue',()=>{
 const p=props(),entries=[...p.eintraege,{id:'TEST-N5-B',text:'TEST Teil B fertig melden',frist:new Date(now+9000).toISOString(),gestartet:false}];
 const view=render(<RueckgaengigLeiste {...p} eintraege={entries}/>);fireEvent.click(screen.getByText(COPY.undo,{selector:'summary'}));
 expect(screen.getByText(COPY.count(2))).toBeVisible();expect(screen.getAllByRole('button')).toHaveLength(2);
 fireEvent.click(screen.getByRole('button',{name:entries[1].text+' · '+COPY.undo}));expect(p.onRueckgaengig).toHaveBeenCalledWith('TEST-N5-B');
 view.rerender(<RueckgaengigLeiste {...p} eintraege={[...entries].reverse()} quelleUnbekannt fehler={COPY.unconfirmed}/>);
 expect(screen.getByText(COPY.unknown)).toBeVisible();expect(screen.getByText(COPY.unconfirmed)).toBeVisible();
 for(const button of screen.getAllByRole('button'))expect(button).toBeDisabled();
 expect(view.container.querySelectorAll('aside')).toHaveLength(1);
});
it('renders no false success, no second bar and no cosmetic command timer for zero originals',()=>{
 const p=props(),view=render(<RueckgaengigLeiste {...p} eintraege={[]}/>);expect(view.container).toBeEmptyDOMElement();
 view.rerender(<RueckgaengigLeiste {...p} eintraege={[]} quelleUnbekannt/>);expect(screen.getByText(COPY.unknown)).toBeVisible();
 expect(screen.queryByRole('button')).toBeNull();expect(p.onRueckgaengig).not.toHaveBeenCalled();
});
