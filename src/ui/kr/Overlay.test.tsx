import {useState} from 'react';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Overlay,type OverlayProps} from './Overlay';
import {V45_TEXT} from '@/ui/situationCatalog';

beforeEach(()=>{
 document.documentElement.dataset.ui='v45';
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:()=>{},removeEventListener:()=>{}})));
});
afterEach(()=>{cleanup();delete document.documentElement.dataset.ui;vi.unstubAllGlobals();});
const source=():OverlayProps=>({variante:'auftrag',bezugId:'TEST-real-context-id',version:7,elternId:'TEST-parent-context',oeffner:null,titel:'TEST geöffneter Auftrag',laden:false,
 fehler:null,vorSchliessen:vi.fn(()=>true),onSchliessen:vi.fn(),onZurueck:vi.fn(),fuss:<button>TEST gebundener Hauptbefehl</button>,children:<input aria-label="TEST ursprünglicher Entwurf" defaultValue="TEST ungesicherter Originalwert"/>});

it.each(['eingang','formular','kunde','auftrag','kv'] as const)('%s uses the existing dialog/guard and retains its draft/version across loading',variante=>{
 const data=source(),view=render(<Overlay {...data} variante={variante}/>);
 const dialog=screen.getByRole('dialog',{name:data.titel});expect(dialog).toHaveClass('ov-box');
 expect(dialog).toHaveAttribute('data-spec-id','baustein.overlay');
 expect(dialog.querySelector('.ov-in')).toHaveAttribute('data-glass','sheet');
 expect(dialog.querySelector('[data-object-id]')).toHaveAttribute('data-source-version','7');
 expect(dialog.querySelector('[data-object-id]')).toHaveAttribute('data-parent-id',data.elternId!);
 fireEvent.change(screen.getByLabelText('TEST ursprünglicher Entwurf'),{target:{value:'TEST noch nicht gespeicherte Änderung'}});
 view.rerender(<Overlay {...data} variante={variante} laden/>);
 expect(screen.getByLabelText('TEST ursprünglicher Entwurf')).toHaveValue('TEST noch nicht gespeicherte Änderung');
 expect(within(dialog).getByRole('button',{name:V45_TEXT.common$close})).toBeDisabled();
 expect(within(dialog).getByRole('button',{name:V45_TEXT.common$back})).toBeDisabled();
 fireEvent.keyDown(window,{key:'Escape'});expect(data.onSchliessen).not.toHaveBeenCalled();
 view.rerender(<Overlay {...data} variante={variante} vorSchliessen={()=>false} fehler={{text:'TEST bestehender Katalogfehler',ton:'fehler'}}/>);
 fireEvent.click(dialog.parentElement!);fireEvent.keyDown(window,{key:'Escape'});
 expect(data.onSchliessen).not.toHaveBeenCalled();expect(screen.getByText('TEST bestehender Katalogfehler')).toBeVisible();
 expect(screen.getByLabelText('TEST ursprünglicher Entwurf')).toHaveValue('TEST noch nicht gespeicherte Änderung');
 view.rerender(<Overlay {...data} variante={variante}/>);
 fireEvent.click(within(dialog).getByRole('button',{name:V45_TEXT.common$back}));expect(data.onZurueck).toHaveBeenCalledOnce();
 fireEvent.click(dialog.parentElement!);expect(data.onSchliessen).toHaveBeenCalledOnce();
});

it('Escape closes only the top existing dialog and keeps the parent source visible',()=>{
 const parent=source(),child=source();
 render(<Overlay {...parent} titel="TEST Elternkontext"><p>TEST Elternoriginal</p><Overlay {...child} titel="TEST Kindkontext"/></Overlay>);
 fireEvent.keyDown(window,{key:'Escape'});
 expect(child.onSchliessen).toHaveBeenCalledOnce();expect(parent.onSchliessen).not.toHaveBeenCalled();
 expect(screen.getByText('TEST Elternoriginal')).toBeVisible();
});

it.each([false,true])('returns focus to the still-mounted invoking control after actual close (child autofocus=%s)',async(autoFocus)=>{
 const data=source(),closed=vi.fn();
 function Scenario(){const [opener,setOpener]=useState<HTMLElement|null>(null);return <><button onClick={event=>setOpener(event.currentTarget)}>TEST ursprünglicher Öffner</button>{opener?<Overlay {...data} oeffner={opener} onSchliessen={()=>{closed();setOpener(null);}}><input aria-label="TEST ursprünglicher Entwurf" autoFocus={autoFocus} defaultValue="TEST unverändert"/></Overlay>:null}</>;}
 render(<Scenario/>);const trigger=screen.getByRole('button',{name:'TEST ursprünglicher Öffner'});
 trigger.focus();fireEvent.click(trigger);
 const close=screen.getByRole('button',{name:V45_TEXT.common$close});expect(close).toHaveClass('ib');expect(close).toHaveFocus();
 fireEvent.click(close);await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(trigger).toHaveFocus();expect(closed).toHaveBeenCalledOnce();
});

it('copies v10 opening250/closing190 motion and closes once during an overlapping second click',async()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false})));
 const descriptor=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'animate');
 const animate=vi.fn<(frames:Keyframe[]|PropertyIndexedKeyframes,options:KeyframeAnimationOptions)=>{finished:Promise<void>}>(()=>({finished:Promise.resolve()}));
 Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,value:animate});
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({x:20,y:20,left:20,top:20,right:100,bottom:60,width:80,height:40,toJSON:()=>({})});
 const trigger=document.createElement('button');trigger.textContent='TEST tatsächlicher Öffner';document.body.append(trigger);trigger.focus();
 try{
  const data=source();render(<Overlay {...data} oeffner={trigger}/>);
  expect(animate.mock.calls.slice(0,2).map(call=>(call[1] as KeyframeAnimationOptions).duration)).toEqual([250,250]);
  const close=screen.getByRole('button',{name:V45_TEXT.common$close});fireEvent.click(close);fireEvent.click(close);
  await waitFor(()=>expect(data.onSchliessen).toHaveBeenCalledOnce());
  expect((animate.mock.calls[2][1] as KeyframeAnimationOptions).duration).toBe(190);
  expect(animate).toHaveBeenCalledTimes(3);
 }finally{
  cleanup();trigger.remove();vi.restoreAllMocks();
  if(descriptor)Object.defineProperty(HTMLElement.prototype,'animate',descriptor);
  else Reflect.deleteProperty(HTMLElement.prototype,'animate');
 }
});
