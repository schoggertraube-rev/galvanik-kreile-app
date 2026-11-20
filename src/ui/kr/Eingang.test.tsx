import {useState} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Eingang,type EingangProps} from './Eingang';

afterEach(cleanup);
const source=():EingangProps=>({originalId:'TEST-original',version:7,variante:'erkannt',label:'TEST unveränderter Eingang',text:'TEST Original\n  mit Leerzeichen & <Wert>',onText:vi.fn(),erfassung:<span>TEST bestehende Capture-Kontrollen</span>,
 dateien:[{id:'TEST-file-A',name:'TEST Anfrage.eml',statusText:'TEST Original gesichert',vorschau:null,ziel:null},{id:'TEST-file-B',name:'TEST Foto.jpg',statusText:'TEST Erkennung offen',vorschau:null,ziel:{id:'TEST-file-B',elementId:'intake.file',text:'TEST Original B öffnen',onWaehlen:vi.fn()}}],
 erkannt:Array.from({length:8},(_,i)=>({id:'TEST-fact-'+i,elementId:'intake.describe',text:'TEST belegtes Feld '+i,onWaehlen:vi.fn()})),
 kandidaten:[{id:'TEST-customer-A',elementId:'intake.assign',text:'TEST Kunde A wählen',onWaehlen:vi.fn()},{id:'TEST-customer-B',elementId:'intake.assign',text:'TEST Kunde B wählen',onWaehlen:vi.fn()}],datenluecken:[],
 aktion:{elementId:'intake.save',text:'TEST vorhandenen Eingang speichern',gesperrt:false,onAusloesen:vi.fn()},laden:false,deaktiviert:false});

it.each(['leer','text','dateien','erkannt','unsicher','offline'] as const)('%s keeps raw text, all files/facts, actual candidate IDs and selection while rereading',variante=>{
 const props=source(),view=render(<Eingang {...props} variante={variante}/>),input=screen.getByRole('textbox');input.focus();
 (input as HTMLTextAreaElement).setSelectionRange(6,11);
 expect(input).toHaveValue(props.text);expect(view.container.querySelectorAll('[data-file-id]')).toHaveLength(2);
 expect(view.container.querySelectorAll('.ein-erk [data-target-id]')).toHaveLength(8);
 fireEvent.click(screen.getByRole('button',{name:'TEST Kunde B wählen'}));expect(props.kandidaten[1].onWaehlen).toHaveBeenCalledWith('TEST-customer-B');
 view.rerender(<Eingang {...props} variante={variante} laden kandidaten={[...props.kandidaten].reverse()}/>);
 expect(input).toHaveFocus();expect(input).toHaveValue(props.text);expect((input as HTMLTextAreaElement).selectionStart).toBe(6);
 expect(screen.getByRole('button',{name:props.aktion!.text})).toBeDisabled();expect(screen.getByText('TEST Erkennung offen')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:props.aktion!.text}));expect(props.aktion!.onAusloesen).not.toHaveBeenCalled();
});

it('does not infer OCR from filename or typing and passes raw text unchanged; Enter remains a newline',()=>{
 const props=source();function Controlled(){const [text,onText]=useState('');return <Eingang {...props} text={text} onText={onText} erkannt={[]} kandidaten={[]} aktion={null}/>;}
 const view=render(<Controlled/>),input=screen.getByRole('textbox');
 fireEvent.change(input,{target:{value:props.text}});expect(input).toHaveValue(props.text);
 expect(fireEvent.keyDown(input,{key:'Enter'})).toBe(true);expect(view.container.querySelectorAll('.ein-erk')).toHaveLength(0);
 expect(view.container.querySelectorAll('input[type=file]')).toHaveLength(0);expect(screen.queryByRole('button',{name:props.aktion!.text})).toBeNull();
});

it('keeps original and known facts when a target is missing, allows zero/one/many candidates, and shows no fake success',()=>{
 const props=source(),view=render(<Eingang {...props} datenluecken={['TEST Zuordnung unlesbar']} kandidaten={[]}
   aktion={{elementId:'intake.save',text:'TEST vorhandenen Eingang speichern',gesperrt:false,onAusloesen:null,grund:'TEST gespeicherter Befehlsbeleg fehlt'}}/>);
 expect(screen.getByText('TEST Zuordnung unlesbar')).toBeVisible();expect(screen.getByText('TEST belegtes Feld 7')).toBeVisible();
 expect(screen.getByRole('button',{name:props.aktion!.text})).toBeDisabled();expect(screen.getByText('TEST gespeicherter Befehlsbeleg fehlt')).toBeVisible();
 view.rerender(<Eingang {...props} kandidaten={[props.kandidaten[1]]}/>);fireEvent.click(screen.getByRole('button',{name:'TEST Original B öffnen'}));
 expect(props.dateien[1].ziel?.onWaehlen).toHaveBeenCalledWith('TEST-file-B');expect(screen.queryByText('TEST Kunde A wählen')).toBeNull();
});
