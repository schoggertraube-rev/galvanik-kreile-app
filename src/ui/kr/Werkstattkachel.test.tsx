import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Werkstattkachel,type WerkstattkachelProps} from './Werkstattkachel';
import {V45_TEXT} from '@/ui/situationCatalog';

afterEach(cleanup);
const fixture=():WerkstattkachelProps=>({auftragId:'TEST-order-A',kundeId:'TEST-customer-B',kunde:'TEST Kunde',nummer:'TEST-A-17',nummerAnzeigen:true,zustand:'info',
 bild:<picture><img src="/TEST-isolated-photo.png" alt="TEST gesichertes Warenfoto"/></picture>,ware:{lang:'TEST 3 Ringe vernickeln',kurz:'TEST 3 Ringe'},
 termin:{haupt:'TEST heute',detail:'TEST belegt'},station:{text:'TEST Galvanik',schritt:1,sichtbar:true},fortschritt:{text:'TEST 1 von 3 fertig',anteil:100/3},
 laden:false,gesperrt:false,hauptaktion:<span>TEST bestehender Hauptbefehl</span>,kurzaktionen:null,weitere:null,onAuftrag:vi.fn(),onKunde:vi.fn()});

it.each([['info','calm'],['warn','warn'],['ral','ral'],['succ','ok']] as const)('retains v10 card slots and the shared %s presentation', (zustand,tone)=>{
 const data=fixture();const view=render(<Werkstattkachel {...data} zustand={zustand}/>);
 const article=view.container.querySelector('article.oc.glass');
 expect(article).toHaveAttribute('data-tone',tone);expect(article).toHaveAttribute('data-id',data.auftragId);
 expect(article?.querySelector('.oc-open .ph img')).toBeInTheDocument();
 expect(article?.querySelector('.rest b')).toHaveTextContent(data.termin.haupt);
 expect(article?.querySelector('[data-b="prog"]')).toHaveTextContent(data.fortschritt.text);
 expect(article?.querySelector('.oc-foot')).toHaveTextContent('TEST bestehender Hauptbefehl');
 fireEvent.click(screen.getByRole('button',{name:V45_TEXT.work$card_order({number:data.nummer})}));
 expect(data.onAuftrag).toHaveBeenCalledWith(data.auftragId);
 fireEvent.click(screen.getByText(V45_TEXT.common$more));
 fireEvent.click(screen.getByRole('button',{name:V45_TEXT.work$card_customer({name:data.kunde})}));
 expect(data.onKunde).toHaveBeenCalledWith(data.kundeId);
});

it('keeps source values and identity across loading and refuses another open, without a false zero progress',()=>{
 const data=fixture();const view=render(<Werkstattkachel {...data}/>);
 view.rerender(<Werkstattkachel {...data} laden nummerAnzeigen={false} station={{...data.station,sichtbar:false}} fortschritt={{text:'TEST Fortschritt unbekannt',anteil:null}}/>);
 const open=screen.getByRole('button',{name:V45_TEXT.work$card_order({number:data.nummer})});
 expect(open).toBeDisabled();fireEvent.click(open);expect(data.onAuftrag).not.toHaveBeenCalled();
 expect(screen.getByText(data.kunde)).toBeInTheDocument();expect(screen.getByText(data.ware.lang)).toBeInTheDocument();
 expect(view.container.querySelector('.prog i')).toHaveAttribute('hidden');
 expect((view.container.querySelector('.prog i') as HTMLElement).style.getPropertyValue('--p')).toBe('');
 expect(view.container.querySelector('.oc-name .ano')).toBeNull();
 expect(view.container.querySelector('.stat')).toHaveAttribute('hidden');
 expect(view.container.querySelector('.oc-foot')).toHaveAttribute('inert');
});

it('keeps the permitted order target without inventing a customer exit or an empty more menu',()=>{
 const data=fixture();render(<Werkstattkachel {...data} onKunde={null}/>);
 expect(screen.queryByText(V45_TEXT.common$more)).toBeNull();
 expect(screen.queryByRole('button',{name:V45_TEXT.work$card_customer({name:data.kunde})})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:V45_TEXT.work$card_order({number:data.nummer})}));
 expect(data.onAuftrag).toHaveBeenCalledWith(data.auftragId);
});
