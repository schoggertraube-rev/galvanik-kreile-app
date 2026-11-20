import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {KVVerlauf,type KVVerlaufProps} from './KVVerlauf';

afterEach(cleanup);
function data():KVVerlaufProps{return {quoteId:'TEST-KV',version:9,fassung:'3',variante:'zugesagt',aktuell:'TEST belegter Zustand',danach:'TEST belegte Folge',datenluecken:[],
  schritte:Array.from({length:5},(_,i)=>({ereignisId:'TEST-event-'+i,zeit:'TEST Zeitpunkt '+i,titel:'TEST Schritt '+i,notiz:'TEST gespeicherte Kanalangabe '+i,
    beleg:{id:'TEST-original-'+i,art:'eingang',text:'TEST Beleg '+i,onOeffnen:vi.fn()}})),verlaufOffen:true,onVerlaufOffen:vi.fn(),laden:false,deaktiviert:false};}

it.each(['entwurf','gesendet','alte_fassung','zugesagt','vorbehalt','ware','auftrag'] as const)('%s keeps actual evidence/version and all history; it never guesses the channel or recreates an original',variante=>{
 const props=data(),view=render(<KVVerlauf {...props} variante={variante}/>),progress=view.container.querySelector('.progress-past')!,history=view.container.querySelector('details')!;
 expect(progress.querySelectorAll('li')).toHaveLength(3);expect(history.querySelectorAll('li')).toHaveLength(5);
 expect(view.container.querySelector('[data-spec-id="baustein.kv_verlauf"]')).toHaveAttribute('data-source-version','9');
 fireEvent.click(within(history as HTMLElement).getByRole('button',{name:'TEST Beleg 0'}));expect(props.schritte[0].beleg?.onOeffnen).toHaveBeenCalledWith('TEST-original-0');
 expect(screen.getByText('TEST gespeicherte Kanalangabe 0')).toBeVisible();expect(view.container.textContent).not.toContain('telefon');
 const first=props.schritte[0];view.rerender(<KVVerlauf {...props} variante={variante} laden schritte={[...props.schritte,{...first,ereignisId:'TEST-event-new',titel:'TEST Folgeereignis'}]}/>);
 expect(history.querySelectorAll('li')).toHaveLength(6);expect(within(history as HTMLElement).getAllByRole('button')[0]).toBeDisabled();
});

it('keeps known history visible while next step or a source is unavailable and has no invented evidence link',()=>{
 const props=data(),view=render(<KVVerlauf {...props} danach={null} datenluecken={['TEST Folgequelle unlesbar']}
   schritte={[{...props.schritte[0],beleg:null},{...props.schritte[1],beleg:{id:'TEST-unavailable',art:'kv',text:'TEST KV Original',onOeffnen:null,grund:'TEST Original nicht lesbar'}}]}/>);
 expect(screen.getByText('TEST Folgequelle unlesbar')).toBeVisible();expect(screen.getByText('TEST belegter Zustand',{exact:false})).toBeVisible();
 expect(view.container.querySelectorAll('[data-source-id="TEST-original-0"]')).toHaveLength(0);
 for(const button of screen.getAllByRole('button',{name:'TEST KV Original'}))expect(button).toBeDisabled();
 expect(view.container.querySelector('.progress-current')?.textContent).not.toContain('Nächster');
});
