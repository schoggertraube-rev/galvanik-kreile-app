import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Kundenbild,type KundenbildProps} from './Kundenbild';
import {V45_TEXT} from '@/ui/situationCatalog';

afterEach(cleanup);
const source=():KundenbildProps=>({kundeId:'TEST-kunde-A',version:'2026-11-20T02:00:00Z',variante:'ruhig',name:'TEST Firma A',kontaktText:'TEST bekannter Kontakt',lage:null,
 zahlung:{zustand:'bekannt',zeilen:[{id:'TEST-terms',text:'TEST tatsächliche Zahlungsvereinbarung'}],leerText:'TEST nicht erfasst'},
 vorgaenge:{zustand:'bekannt',zeilen:[{id:'TEST-order-A',elementId:'order.open',text:'TEST offener Auftrag A',onOeffnen:vi.fn()},{id:'TEST-order-B',elementId:'order.open',text:'TEST offener Auftrag B',onOeffnen:vi.fn()}],leerText:V45_TEXT.customer$orders_empty},
 absprachen:{zustand:'bekannt',zeilen:[{id:'TEST-agreement',text:'TEST belegte Absprache'}],leerText:V45_TEXT.customer$agreement_empty},
 belege:{zustand:'bekannt',zeilen:[{id:'TEST-original',elementId:'document.open',text:'TEST tatsächliches Original',onOeffnen:vi.fn()}],leerText:V45_TEXT.common$empty},belegeTitel:V45_TEXT.customer$tab$files,
 kundenkarte:{id:'TEST-kunde-A',elementId:'customer.open',text:'TEST echte Kundenkarte öffnen',onOeffnen:vi.fn()},mail:null,laden:false});

it.each(['ruhig','ueberfaellig','vereinbarung','leer'] as const)('%s shows only supplied facts and preserves original targets after reread',variante=>{
 const data=source(),view=render(<Kundenbild {...data} variante={variante}/>);
 expect(view.container.querySelector('[data-spec-id="baustein.kundenbild"]')).toHaveAttribute('data-source-version',String(data.version));
 expect(screen.getByRole('heading',{name:data.name})).toBeVisible();expect(screen.getByText('TEST belegte Absprache')).toBeVisible();
 expect(screen.getByText(V45_TEXT.customer$group$bedingungen)).toBeVisible();expect(screen.getByText(V45_TEXT.customer$tab$agreements)).toBeVisible();
 if(data.vorgaenge.zustand!=='bekannt')throw Error('TEST_KNOWN_ROWS_REQUIRED');
 const row=data.vorgaenge.zeilen[1],button=screen.getByRole('button',{name:row.text});button.focus();
 view.rerender(<Kundenbild {...data} variante={variante} vorgaenge={{...data.vorgaenge,zeilen:[...data.vorgaenge.zeilen].reverse()}}/>);
 expect(button).toHaveFocus();fireEvent.click(button);expect(row.onOeffnen).toHaveBeenLastCalledWith(row.id);
 fireEvent.click(screen.getByRole('button',{name:data.kundenkarte!.text}));expect(data.kundenkarte!.onOeffnen).toHaveBeenLastCalledWith(data.kundeId);
 expect(view.container.querySelector('details')).toBeNull();
});

it('keeps unknown distinct from an actual zero while preserving known agreements and contact',()=>{
 const data=source(),view=render(<Kundenbild {...data} vorgaenge={{zustand:'unbekannt',text:'TEST Vorgangsquelle nicht lesbar'}}/>);
 expect(screen.getByText('TEST Vorgangsquelle nicht lesbar')).toBeVisible();expect(screen.queryByText(V45_TEXT.customer$orders_empty)).toBeNull();
 expect(screen.getByText('TEST belegte Absprache')).toBeVisible();expect(screen.getByText(data.kontaktText)).toBeVisible();
 view.rerender(<Kundenbild {...data} vorgaenge={{zustand:'bekannt',zeilen:[],leerText:V45_TEXT.customer$orders_empty}}/>);
 expect(screen.getByText(V45_TEXT.customer$orders_empty)).toBeVisible();
 view.rerender(<Kundenbild {...data} vorgaenge={{zustand:'bekannt',zeilen:data.vorgaenge.zustand==='bekannt'?data.vorgaenge.zeilen.slice(0,1):[],leerText:V45_TEXT.customer$orders_empty}}/>);
 expect(screen.getByRole('button',{name:'TEST offener Auftrag A'})).toBeVisible();expect(screen.queryByRole('button',{name:'TEST offener Auftrag B'})).toBeNull();
});

it('does not expose withheld money sections, keeps drafts/facts on loading and renders no unbound More exit',()=>{
 const data=source(),view=render(<Kundenbild {...data} belege={{zustand:'verborgen'}} zahlung={{zustand:'verborgen'}} laden/>);
 expect(screen.queryByText('TEST tatsächliches Original')).toBeNull();expect(screen.queryByText('TEST tatsächliche Zahlungsvereinbarung')).toBeNull();
 expect(screen.getByText('TEST belegte Absprache')).toBeVisible();const open=screen.getByRole('button',{name:data.kundenkarte!.text});expect(open).toBeDisabled();
 fireEvent.click(open);expect(data.kundenkarte!.onOeffnen).not.toHaveBeenCalled();
 view.rerender(<Kundenbild {...data} kundenkarte={null} mail={null}/>);expect(view.container.querySelector('details')).toBeNull();
});
