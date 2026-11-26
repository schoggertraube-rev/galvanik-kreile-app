import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {StrictMode,useState} from 'react';
import {KrApp} from './AppShell';
import {Dialog} from './Dialog';
import {Seitenblatt} from './Seitenblatt';
import glasStile from './design-final/GlasDialog.module.css';

afterEach(cleanup);

it('gibt im Dock-Blatt dem sichtbaren Schließknopf den Fokus und schließt am Griff',()=>{
  const geschlossen=vi.fn();
  render(<KrApp geraet="handy"><Dialog titel="Mehr" amDock onSchliessen={geschlossen}>
    <button type="button">TEST Weiter</button>
  </Dialog></KrApp>);

  const dialog=screen.getByRole('dialog',{name:'Mehr'});
  const schliessen=within(dialog).getByRole('button',{name:'Schließen'});
  expect(schliessen.closest('header')).not.toHaveClass('kr-sr');
  expect(schliessen.tabIndex).toBe(0);
  expect(schliessen).toHaveFocus();

  const griff=dialog.getElementsByClassName(glasStile.griff)[0];
  expect(griff).toBeInstanceOf(HTMLElement);
  Object.defineProperty(griff,'setPointerCapture',{value:vi.fn()});
  fireEvent(griff,new MouseEvent('pointerdown',{bubbles:true,clientY:12}));
  fireEvent(griff,new MouseEvent('pointerup',{bubbles:true,clientY:64}));
  expect(geschlossen).toHaveBeenCalledOnce();
});

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

it('schließt am Handy per Browser-Zurück jeweils ein Blatt und erhält Ort, Eingabe und Fokus',async()=>{
  const ort=window.location.href;
  const geschlossen=vi.fn();
  function Karte(){
    const [offen,setOffen]=useState(false);
    const [karteOffen,setKarteOffen]=useState(true);
    return karteOffen && <Seitenblatt titel="TEST Auftragskarte" onSchliessen={()=>{setKarteOffen(false);geschlossen();}}>
      <label>TEST Notiz<input defaultValue="TEST Entwurf"/></label>
      <button type="button" onClick={()=>setOffen(true)}>TEST Änderung öffnen</button>
      {offen && <Dialog titel="TEST Änderung" onSchliessen={()=>setOffen(false)}><p>TEST Änderung</p></Dialog>}
    </Seitenblatt>;
  }
  render(<StrictMode><KrApp geraet="handy"><Karte/></KrApp></StrictMode>);
  const ausloeser=screen.getByRole('button',{name:'TEST Änderung öffnen'});
  ausloeser.focus();
  fireEvent.click(ausloeser);
  window.history.back();
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'TEST Änderung'})).not.toBeInTheDocument());
  expect(window.location.href).toBe(ort);
  expect(screen.getByRole('dialog',{name:'TEST Auftragskarte'})).toBeInTheDocument();
  expect(screen.getByRole('textbox',{name:'TEST Notiz'})).toHaveValue('TEST Entwurf');
  expect(ausloeser).toHaveFocus();
  expect(geschlossen).not.toHaveBeenCalled();
  window.history.back();
  await waitFor(()=>expect(geschlossen).toHaveBeenCalledOnce());
  expect(window.location.href).toBe(ort);
});

it('behält am Handy den Rückweg, wenn das Blatt den Entwurf vor dem Schließen schützt',async()=>{
  const close=vi.fn();
  const canClose=vi.fn(()=>false);
  render(<KrApp geraet="handy"><Dialog titel="TEST Eingabe" vorSchliessen={canClose} onSchliessen={close}>
    <label>TEST Feld<input defaultValue="TEST Original"/></label>
  </Dialog></KrApp>);
  window.history.back();
  await waitFor(()=>expect(canClose).toHaveBeenCalledOnce());
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox')).toHaveValue('TEST Original');
  canClose.mockReturnValue(true);
  window.history.back();
  await waitFor(()=>expect(close).toHaveBeenCalledOnce());
});
