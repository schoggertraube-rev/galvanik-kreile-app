import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {useState} from 'react';
import {Dialog} from './Dialog';
import {Seitenblatt} from './Seitenblatt';

afterEach(cleanup);

it('schließt nur das oberste Blatt und bringt den Fokus zum echten Auslöser zurück',()=>{
  const closed=vi.fn();
  function TestCard(){
    const [open,setOpen]=useState(false);
    return <Seitenblatt titel="TEST Auftragskarte" onSchliessen={closed}>
      <button type="button" onClick={()=>setOpen(true)}>TEST Änderung öffnen</button>
      {open && <Dialog titel="TEST Änderung" onSchliessen={()=>setOpen(false)}>
        <p>TEST Entwurf bleibt bis zum Schließen erhalten</p>
      </Dialog>}
    </Seitenblatt>;
  }
  render(<TestCard/>);
  const opener=screen.getByRole('button',{name:'TEST Änderung öffnen'});
  opener.focus();
  fireEvent.click(opener);
  const top=screen.getByRole('dialog',{name:'TEST Änderung'});
  fireEvent.click(within(top).getByRole('button',{name:'Schließen'}));
  expect(screen.queryByRole('dialog',{name:'TEST Änderung'})).not.toBeInTheDocument();
  expect(screen.getByRole('dialog',{name:'TEST Auftragskarte'})).toBeInTheDocument();
  expect(opener).toHaveFocus();
  expect(closed).not.toHaveBeenCalled();
});

it('erhält ein Blatt mit ungespeichertem Entwurf, wenn das Schließen abgelehnt wird',()=>{
  const close=vi.fn(), canClose=vi.fn(()=>false);
  render(<Dialog titel="TEST Eingabe" dataSpecId="TEST-eingabe" vorSchliessen={canClose} onSchliessen={close}>
    <label>TEST Feld<input defaultValue="TEST Original"/></label>
  </Dialog>);
  fireEvent.click(screen.getByRole('button',{name:'Schließen'}));
  expect(screen.getByRole('dialog',{name:'TEST Eingabe'})).toHaveAttribute('data-spec-id','TEST-eingabe');
  expect(screen.getByRole('textbox')).toHaveValue('TEST Original');
  expect(canClose).toHaveBeenCalledOnce();
  expect(close).not.toHaveBeenCalled();
});
