import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Mehrarbeit,type MehrarbeitProps} from './Mehrarbeit';
import {V45_TEXT} from '@/ui/situationCatalog';

afterEach(cleanup);
const source=():MehrarbeitProps=>({auftragId:'TEST-Auftrag',teilId:'TEST-Teil-B',version:8,variante:'gewaehlt',
 teile:[{wert:'TEST-Teil-A',text:'TEST Teil A'},{wert:'TEST-Teil-B',text:'TEST Teil B'}],aktivitaetId:'TEST-Polieren',
 aktivitaeten:[{id:'TEST-Polieren',text:'TEST Polieren',dauerText:'TEST 15 min'},{id:'TEST-Schleifen',text:'TEST Schleifen',dauerText:null}],
 minuten:'15',dauerText:'TEST 15 min',grenzen:{min:0,max:360,schritt:5},grund:'TEST vorhandener Grund',
 statusText:'TEST Erfassung ist keine Freigabe',zusammenfassung:<p>TEST ursprüngliche Gesamtdauer</p>,preisfeld:null,belege:<p>TEST vorhandener Eingangsbeleg</p>,
 laden:false,deaktiviert:false,fehler:null,aktion:{text:'TEST Mehrarbeit vormerken',gesperrt:false,onAusloesen:vi.fn()},
 onTeil:vi.fn(),onAktivitaet:vi.fn(),onMinuten:vi.fn(),onGrund:vi.fn()});

it.each(['auswahl','gewaehlt','freigabe_offen'] as const)('%s retains exact order/part/version and has no implicit price or approval',variante=>{
 const data=source(),view=render(<Mehrarbeit {...data} variante={variante}/>);
 const sourceNode=view.container.querySelector('[data-spec-id="baustein.mehrarbeit"]');
 expect(sourceNode).toHaveAttribute('data-source-version','8');expect(sourceNode).toHaveAttribute('data-object-id',data.auftragId);expect(sourceNode).toHaveAttribute('data-part-id',data.teilId);
 expect(screen.getByRole('button',{name:'TEST Polieren TEST 15 min'})).toHaveAttribute('aria-pressed','true');
 fireEvent.click(screen.getByRole('button',{name:'TEST Schleifen'}));expect(data.onAktivitaet).toHaveBeenLastCalledWith('TEST-Schleifen');
 expect(screen.getByRole('spinbutton')).toHaveValue(15);expect(data.aktion.onAusloesen).not.toHaveBeenCalled();
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'25'}});expect(data.onMinuten).toHaveBeenLastCalledWith('25');
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'TEST-Teil-A'}});expect(data.onTeil).toHaveBeenLastCalledWith('TEST-Teil-A');
 fireEvent.change(screen.getByLabelText(V45_TEXT.werkzeit$optional),{target:{value:'TEST korrigierter Grund'}});expect(data.onGrund).toHaveBeenLastCalledWith('TEST korrigierter Grund');
 expect(screen.getByText(data.statusText)).toBeVisible();expect(screen.queryByLabelText(V45_TEXT.werkzeit$price)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:data.aktion.text}));expect(data.aktion.onAusloesen).toHaveBeenCalledOnce();
});

it('preserves drafts and known evidence while blocked and retains keyed activity focus after a source reorder',()=>{
 const data=source(),view=render(<Mehrarbeit {...data}/>),activity=screen.getByRole('button',{name:'TEST Schleifen'});
 activity.focus();view.rerender(<Mehrarbeit {...data} aktivitaeten={[...data.aktivitaeten].reverse()}/>);expect(activity).toHaveFocus();
 view.rerender(<Mehrarbeit {...data} laden fehler="TEST Folgewirkung fehlt"/>);
 expect(screen.getByRole('spinbutton')).toBeDisabled();expect(screen.getByRole('spinbutton')).toHaveValue(15);
 expect(screen.getByLabelText(V45_TEXT.werkzeit$optional)).toHaveValue(data.grund);expect(screen.getByRole('combobox')).toHaveValue(data.teilId);
 expect(screen.getByText('TEST vorhandener Eingangsbeleg')).toBeVisible();expect(screen.getByText('TEST Folgewirkung fehlt')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:data.aktion.text}));expect(data.aktion.onAusloesen).not.toHaveBeenCalled();
});

it('keeps unknown duration empty and receives price controls only from its already authorized caller',()=>{
 const data=source(),view=render(<Mehrarbeit {...data} minuten="" dauerText="TEST nicht erfasst" aktivitaetId={null}/>);
 expect(screen.queryByRole('slider')).toBeNull();expect(screen.getByRole('spinbutton')).toHaveValue(null);
 expect(screen.getByRole('button',{name:'TEST Polieren TEST 15 min'})).toHaveAttribute('aria-pressed','false');
 view.rerender(<Mehrarbeit {...data} preisfeld={<span>TEST ausdrücklich freigegebener Preis</span>}/>);
 expect(screen.getByText('TEST ausdrücklich freigegebener Preis')).toBeVisible();
 view.rerender(<Mehrarbeit {...data} preisfeld={null}/>);expect(screen.queryByText('TEST ausdrücklich freigegebener Preis')).toBeNull();
});

it('retains the draft and a concrete exit reason when the catalog/part command is not yet bound',()=>{
 const data=source();render(<Mehrarbeit {...data} aktivitaeten={[]} aktion={{text:data.aktion.text,onAusloesen:null,gesperrt:false,grund:'TEST Tätigkeitskatalog fehlt; vorhandenen Entwurf behalten'}}/>);
 expect(screen.getByRole('spinbutton')).toHaveValue(15);expect(screen.getByRole('combobox')).toHaveValue(data.teilId);
 expect(screen.getByRole('button',{name:data.aktion.text})).toBeDisabled();
 expect(screen.getByRole('button',{name:data.aktion.text})).toHaveAccessibleDescription('TEST Tätigkeitskatalog fehlt; vorhandenen Entwurf behalten');
});
it('does not create a range or clamp a known input when no operating limits are supplied',()=>{
 const data=source();render(<Mehrarbeit {...data} grenzen={null}/>);
 expect(screen.queryByRole('slider')).toBeNull();expect(screen.getByRole('spinbutton')).toHaveValue(15);
 expect(screen.getByRole('spinbutton')).not.toHaveAttribute('min');expect(screen.getByRole('spinbutton')).not.toHaveAttribute('max');
});
