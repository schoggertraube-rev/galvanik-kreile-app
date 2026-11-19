import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {Formularfeld,type FormularfeldProps} from './Formularfeld';

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
