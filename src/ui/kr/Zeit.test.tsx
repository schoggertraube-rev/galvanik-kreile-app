import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Zeit,type ZeitProps} from './Zeit';
import {V45_TEXT} from '@/ui/situationCatalog';

afterEach(cleanup);
const source=():ZeitProps=>({auftragId:'TEST-order',version:7,variante:'heute_erfasst',datum:'2026-11-19',heute:'2026-11-20',minuten:'90',dauerText:'TEST 1 h 30 min',enthaltenText:'TEST 20 min Mehrarbeit',notiz:'TEST ursprünglicher Tageswert',
 auswahl:[{wert:'30',text:'TEST 30 min'},{wert:'60',text:'TEST 1 h'}],grenzen:{min:0,max:720,schritt:1},verteilung:<p>TEST unveränderte Teilzuordnung</p>,laden:false,deaktiviert:false,fehler:null,
 aktion:{text:V45_TEXT.werkzeit$save({duration:'TEST 1 h 30 min'}),onAusloesen:vi.fn(),gesperrt:false},onDatum:vi.fn(),onMinuten:vi.fn(),onNotiz:vi.fn()});

it.each(['heute_offen','heute_erfasst','historisch'] as const)('%s preserves daily source/context and sends the full corrected value instead of incrementing it',variante=>{
 const data=source(),view=render(<Zeit {...data} variante={variante}/>);
 expect(view.container.querySelector('[data-spec-id="baustein.zeit"]')).toHaveAttribute('data-source-version','7');
 expect(screen.getByText(data.enthaltenText)).toBeInTheDocument();expect(screen.getByText('TEST unveränderte Teilzuordnung')).toBeInTheDocument();
 fireEvent.change(screen.getByRole('spinbutton',{name:V45_TEXT.work$time_total}),{target:{value:'75'}});
 expect(data.onMinuten).toHaveBeenLastCalledWith('75');
 fireEvent.click(screen.getByRole('button',{name:'TEST 30 min'}));expect(data.onMinuten).toHaveBeenLastCalledWith('30');
 fireEvent.click(screen.getByRole('button',{name:data.aktion.text}));expect(data.aktion.onAusloesen).toHaveBeenCalledOnce();
 expect(screen.getByRole('spinbutton')).toHaveValue(90);
});
it('keeps a failed draft through loading and has no fabricated save when the existing time writer is unbound',()=>{
 const data=source(),view=render(<Zeit {...data}/>);
 view.rerender(<Zeit {...data} laden fehler="TEST vorhandener Speicherfehler"/>);
 expect(screen.getByRole('spinbutton')).toBeDisabled();expect(screen.getByRole('spinbutton')).toHaveValue(90);
 expect(screen.getByLabelText(V45_TEXT.work$time_note)).toHaveValue(data.notiz);expect(screen.getByText('TEST vorhandener Speicherfehler')).toBeVisible();
 const reason='TEST fehlender Fachport, keine simulierte Speicherung';
 view.rerender(<Zeit {...data} aktion={{text:data.aktion.text,onAusloesen:null,gesperrt:true,grund:reason}}/>);
 const save=screen.getByRole('button',{name:data.aktion.text});expect(save).toBeDisabled();expect(save).toHaveAccessibleDescription(reason);
 fireEvent.click(save);expect(data.aktion.onAusloesen).not.toHaveBeenCalled();
});
it('retains an empty/unknown duration without the native range inventing its midpoint and passes raw controlled edits',()=>{
 const data=source(),view=render(<Zeit {...data} minuten="" dauerText="TEST nicht erfasst"/>);
 expect(screen.queryByRole('slider')).toBeNull();expect(screen.getByRole('spinbutton')).toHaveValue(null);
 // Enter field navigation is asserted with genuine visible layout in s18_controls.browser.integration.test.ts.
 const date=screen.getByLabelText(V45_TEXT.work$time_date);expect(date).toHaveAttribute('max',data.heute);
 view.rerender(<Zeit {...data} minuten="60" dauerText="TEST 1 h"/>);
 fireEvent.change(screen.getByRole('slider'),{target:{value:'45'}});expect(data.onMinuten).toHaveBeenLastCalledWith('45');
 const note=screen.getByLabelText(V45_TEXT.work$time_note);note.focus();fireEvent.keyDown(note,{key:'Enter'});expect(note).toHaveFocus();
});
it('keeps a supplied duration editable without inventing missing range settings',()=>{
 const data=source();render(<Zeit {...data} grenzen={null}/>);
 expect(screen.queryByRole('slider')).toBeNull();expect(screen.getByRole('spinbutton')).toHaveValue(90);
 expect(screen.getByRole('spinbutton')).not.toHaveAttribute('max');
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'77'}});expect(data.onMinuten).toHaveBeenCalledWith('77');
});
