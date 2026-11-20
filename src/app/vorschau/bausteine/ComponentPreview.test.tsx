// Explicitly synthetic read-port boundaries, not an Auth/DB or App proof.
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import type {ComponentProps} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {ComponentPreview} from './ComponentPreview';
import {COMPONENT_PREVIEW_COPY as COPY,V45_TEXT} from '@/ui/situationCatalog';
const navigation=vi.hoisted(()=>({push:vi.fn(),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>navigation}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const props=():ComponentProps<typeof ComponentPreview>=>({customer:null,quote:null,capture:null,master:null,source:{card:{
 id:'TEST-order',version:8,orderNumber:'TEST-123',customerId:'TEST-customer',customerName:'TEST Firma',customerPhone:null,title:'TEST Teile',note:null,
 station:'galvanik',status:'in_bearbeitung',dueAt:null,intakeAt:'2026-11-20T01:00:00Z',handoverMode:null,assignment:null,assignmentOptions:[],dueDateChanges:[],labelPrints:[],freeze:null,agreement:null,agreementHint:null,
 items:[{id:'TEST-part-A',position:1,name:'TEST Teil A',quantity:4,material:null,surfaceRequested:'TEST Zink blau',catalogServiceId:null,unit:null,unitPriceCents:null,vatRateBasisPoints:null,finished:false,extraWork:[]},
 {id:'TEST-part-B',position:2,name:'TEST Teil B',quantity:3,material:null,surfaceRequested:'TEST Chrom',catalogServiceId:null,unit:null,unitPriceCents:null,vatRateBasisPoints:null,finished:true,extraWork:[]}],
 },evidence:[]}});
const select=(component:string)=>fireEvent.change(screen.getByRole('combobox',{name:COPY.component}),{target:{value:component}});

it('opens the actual selected part, keeps unknown counts unknown and never uses an unimplemented position URL',()=>{
 const view=render(<ComponentPreview {...props()}/>);select('teilchip');
 const partA=screen.getByRole('button',{name:V45_TEXT.work$card_part({part:'TEST Teil A'})});
 expect(partA).toHaveTextContent(V45_TEXT.work$card_total({done:'—',total:'4'}));
 fireEvent.click(screen.getByRole('button',{name:V45_TEXT.work$card_part({part:'TEST Teil B'})}));
 expect(view.container.querySelector('[data-preview-part-id]')).toHaveAttribute('data-preview-part-id','TEST-part-B');
 expect(navigation.push).not.toHaveBeenCalled();
 select('hauptaktion');fireEvent.click(screen.getByRole('button',{name:COPY.open}));expect(navigation.push).toHaveBeenCalledWith('/orders/TEST-order');
});

it('shows missing facts without a calm status, price, range bound or a fabricated save; drafts survive state changes',()=>{
 const view=render(<ComponentPreview {...props()}/>);expect(view.container.querySelector('[data-spec-id="baustein.lage"]')).toBeNull();
 select('werkstattkachel');expect(view.container.querySelector('[data-spec-id="werkstatt.zeile"]')).not.toHaveAttribute('data-tone');
 select('zeit');expect(screen.queryByRole('slider')).toBeNull();expect(screen.getByRole('spinbutton')).not.toHaveAttribute('max');
 expect(screen.getByRole('button',{name:V45_TEXT.common$save})).toBeDisabled();
 select('formularfeld');fireEvent.change(screen.getByRole('textbox'),{target:{value:'TEST unveränderter Entwurf'}});
 fireEvent.change(screen.getByRole('combobox',{name:COPY.state}),{target:{value:'laden'}});
 expect(screen.getByRole('textbox')).toHaveValue('TEST unveränderter Entwurf');expect(screen.getByRole('textbox')).toBeDisabled();
 expect(navigation.push).not.toHaveBeenCalled();
});

it('offers all sixteen source components without introducing a second intake reader or writer',()=>{
 const view=render(<ComponentPreview {...props()}/>);
 expect(screen.getByRole('combobox',{name:COPY.component}).querySelectorAll('option')).toHaveLength(16);
 select('eingang');expect(view.container.querySelector('input[type=file]')).toBeNull();
 expect(screen.getByRole('button',{name:V45_TEXT.common$save})).toBeDisabled();expect(screen.getByText(COPY.draft)).toBeVisible();
 select('mehrarbeit');expect(screen.queryByRole('slider')).toBeNull();expect(screen.getByText(COPY.unavailable)).toBeVisible();
 select('kv_dokument');expect(screen.getByText(COPY.noFact)).toBeVisible();
});
