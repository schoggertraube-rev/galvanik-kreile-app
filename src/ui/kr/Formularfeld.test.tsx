import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {Formularfeld,type FormularfeldProps} from './Formularfeld';
import {Eingabe,Feld} from './Formular';

afterEach(cleanup);

const values:FormularfeldProps[]=[
  {art:'text',wert:'TEST Originaltext'},
  {art:'zahl',wert:'17'},
  {art:'datum',wert:'2026-11-20'},
  {art:'mehrzeilig',wert:'TEST erste Zeile\nTEST zweite Zeile'},
  {art:'auswahl',wert:'TEST-b',optionen:[{wert:'TEST-a',text:'TEST A'},{wert:'TEST-b',text:'TEST B'}]},
  {art:'checkbox',wert:true},
].map(value=>({...value,id:'TEST-field',label:'TEST Feld',laden:false,deaktiviert:false,onWert:vi.fn()})) as FormularfeldProps[];

it.each(values)('preserves $art input after a failed save and during reread',props=>{
  const view=render(<Formularfeld {...props}/>);
  const field=screen.getByLabelText('TEST Feld');
  const before=props.art==='checkbox'?(field as HTMLInputElement).checked:(field as HTMLInputElement).value;
  view.rerender(<Formularfeld {...props} laden fehler={{text:'TEST Speichern fehlgeschlagen',specId:'error.save'}}/>);
  expect(field).toBeDisabled();
  expect(props.art==='checkbox'?(field as HTMLInputElement).checked:(field as HTMLInputElement).value).toBe(before);
  expect(field).toHaveAccessibleDescription('TEST Speichern fehlgeschlagen');
  view.rerender(<Formularfeld {...props}/>);
  field.focus();
  expect(field).toHaveFocus();
  expect(field).not.toBeDisabled();
});

it('returns the entered value without domain conversion and keeps multiline Enter local',()=>{
  const changed=vi.fn();
  render(<Formularfeld id="TEST-note" label="TEST Notiz" art="mehrzeilig" wert="TEST Original"
    laden={false} deaktiviert={false} onWert={changed}/>);
  const field=screen.getByLabelText('TEST Notiz');
  expect(fireEvent.keyDown(field,{key:'Enter'})).toBe(true);
  fireEvent.change(field,{target:{value:'TEST Original\nTEST Folge'}});
  expect(changed).toHaveBeenCalledWith('TEST Original\nTEST Folge');
});

it('setzt nur ein erlaubtes Datum in das vorhandene Formularfeld',async()=>{
  const changed=vi.fn();
  render(<Formularfeld id="TEST-datum" label="TEST Datum" art="datum" wert="2026-11-20"
    grenzen={{max:'2026-11-22'}} laden={false} deaktiviert={false} onWert={changed}/>);
  fireEvent.keyDown(screen.getByLabelText('TEST Datum'),{key:'F4'});
  const wahl=within(screen.getByRole('dialog',{name:'TEST Datum'}));
  expect(wahl.getByRole('button',{name:'Nächster Monat'})).toBeDisabled();
  expect(wahl.getByRole('button',{name:/23\. November 2026/})).toBeDisabled();
  expect(changed).not.toHaveBeenCalled();
  fireEvent.click(wahl.getByRole('button',{name:/22\. November 2026/}));
  expect(changed).toHaveBeenCalledExactlyOnceWith('2026-11-22');
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});

it('setzt den angetippten Minutenwert mit der gewählten Stunde in den vorhandenen Entwurf',async()=>{
  const changed=vi.fn();
  render(<Feld label="TEST Uhrzeit"><Eingabe type="time" value="10:30"
    onChange={event=>changed(event.currentTarget.value)}/></Feld>);
  fireEvent.keyDown(screen.getByLabelText('TEST Uhrzeit'),{key:'ArrowDown',altKey:true});
  const wahl=within(screen.getByRole('dialog',{name:'TEST Uhrzeit'}));
  fireEvent.click(wahl.getByRole('button',{name:'Stunden erhöhen'}));
  expect(changed).not.toHaveBeenCalled();
  fireEvent.click(wahl.getByText('47'));
  expect(changed).toHaveBeenCalledExactlyOnceWith('11:47');
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});

it('behält die genaue Dezimalzahl bis zur Übernahme und verwirft die offene Wahl mit Browser-Zurück',async()=>{
  const changed=vi.fn();
  render(<Feld label="TEST Menge"><Eingabe type="number" value="1" min="0" max="5" step="0.001"
    onChange={event=>changed(event.currentTarget.value)}/></Feld>);
  const feld=screen.getByRole('spinbutton',{name:'TEST Menge'});
  fireEvent.keyDown(feld,{key:'F4'});
  let wahl=within(screen.getByRole('dialog',{name:'TEST Menge'}));
  fireEvent.click(wahl.getByRole('button',{name:'Leeren'}));
  for(const taste of ['0','Dezimalkomma','3','7','5']) fireEvent.click(wahl.getByRole('button',{name:taste}));
  expect(changed).not.toHaveBeenCalled();
  window.history.back();
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  expect(changed).not.toHaveBeenCalled();
  expect(feld).toHaveValue(1);
  fireEvent.keyDown(feld,{key:'F4'});
  wahl=within(screen.getByRole('dialog',{name:'TEST Menge'}));
  fireEvent.click(wahl.getByRole('button',{name:'Gerätetastatur'}));
  fireEvent.change(wahl.getByRole('textbox',{name:'Wert direkt eingeben'}),{target:{value:'0,375'}});
  fireEvent.click(wahl.getByRole('button',{name:'Wert übernehmen'}));
  expect(changed).toHaveBeenCalledExactlyOnceWith('0.375');
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});
