import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Teilchip,type TeilchipProps} from './Teilchip';
import {V45_TEXT} from '@/ui/situationCatalog';

afterEach(()=>{cleanup();delete document.documentElement.dataset.ui;});
const source=(suffix:string,gut=0):TeilchipProps=>({auftragId:'TEST-order-'+suffix,teilId:'TEST-part-'+suffix,name:'TEST Teil '+suffix,gut,menge:3,zustand:'offen',laden:false,deaktiviert:false,onOeffnen:vi.fn()});
it.each([['offen',0],['teilfertig',1],['fertig',3]] as const)('opens precisely the supplied part in its order for %s without changing the source count',(zustand,gut)=>{
 const data=source('A',gut);
 document.documentElement.dataset.ui='v45';
 render(<Teilchip {...data} zustand={zustand}/>);
 const button=screen.getByRole('button',{name:V45_TEXT.work$card_part({part:data.name})});
 expect(button).toHaveAttribute('data-form','text');
 expect(button).toHaveAttribute('data-zustand',zustand);expect(button).toHaveAttribute('data-spec-id','work.part');
 expect(button).toHaveTextContent(V45_TEXT.work$card_total({done:String(gut),total:'3'}));
 button.focus();expect(button).toHaveFocus();fireEvent.click(button);
 expect(data.onOeffnen).toHaveBeenCalledExactlyOnceWith({auftragId:data.auftragId,teilId:data.teilId});
 expect(button).toHaveTextContent(V45_TEXT.work$card_total({done:String(gut),total:'3'}));
});
it('retains the original part and quantities while loading and exposes the given disabled reason',()=>{
 const data=source('B',1),view=render(<Teilchip {...data} zustand="teilfertig"/>);
 view.rerender(<Teilchip {...data} zustand="teilfertig" laden/>);
 const button=screen.getByRole('button');expect(button).toBeDisabled();fireEvent.click(button);expect(data.onOeffnen).not.toHaveBeenCalled();
 expect(button).toHaveAttribute('data-order-id',data.auftragId);expect(button).toHaveAttribute('data-object-id',data.teilId);
 expect(button).toHaveTextContent(V45_TEXT.work$card_total({done:'1',total:'3'}));
 view.rerender(<Teilchip {...data} zustand="teilfertig" deaktiviert grund="TEST bestehender Rechte-Grund"/>);
 expect(button).toHaveAttribute('title','TEST bestehender Rechte-Grund');expect(button).toBeDisabled();
});
it('preserves all source choices and their identities after a list is reordered',()=>{
 const values=[source('1'),source('2',1),source('3',3)];
 const nodes=(rows:TeilchipProps[])=>rows.map(row=><Teilchip {...row} key={row.teilId}/>);
 const view=render(<>{nodes(values)}</>);expect(screen.getAllByRole('button')).toHaveLength(3);
 view.rerender(<>{nodes(values.slice().reverse())}</>);
 fireEvent.click(screen.getByRole('button',{name:V45_TEXT.work$card_part({part:values[1].name})}));
 expect(values[1].onOeffnen).toHaveBeenCalledExactlyOnceWith({auftragId:values[1].auftragId,teilId:values[1].teilId});
 expect(values[0].onOeffnen).not.toHaveBeenCalled();expect(values[2].onOeffnen).not.toHaveBeenCalled();
});
it('shows an unknown finished quantity without inventing zero or a part state',()=>{
 const data=source('unknown'),view=render(<Teilchip {...data} gut={null} zustand={null}/>);
 expect(screen.getByRole('button')).toHaveTextContent(V45_TEXT.work$card_total({done:'—',total:'3'}));
 expect(view.container.querySelector('[data-zustand]')).toBeNull();
});
