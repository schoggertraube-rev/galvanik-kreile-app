// @vitest-environment jsdom
// Synthetic DOM boundaries only: source selectors feed the existing keyboard entry.
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {weiterMitEnter} from '@/ui/kr/tastatur';
afterEach(()=>{cleanup();delete document.documentElement.dataset.ui;vi.restoreAllMocks();});
it('uses the original fgrid order and existing primary callback once; disabled stays disabled',()=>{
 document.documentElement.dataset.ui='v45';const save=vi.fn();
 render(<div onKeyDown={weiterMitEnter}><div className="fgrid"><input aria-label="TEST first"/><input aria-label="TEST last"/></div><button id="kfGo" onClick={save}>TEST save</button></div>);
 fireEvent.keyDown(screen.getByLabelText('TEST first'),{key:'Enter'});
 expect(document.activeElement).toBe(screen.getByLabelText('TEST last'));
 fireEvent.keyDown(screen.getByLabelText('TEST last'),{key:'Enter'});expect(save).toHaveBeenCalledTimes(1);
 screen.getByRole('button').setAttribute('disabled','');
 fireEvent.keyDown(screen.getByLabelText('TEST last'),{key:'Enter'});expect(save).toHaveBeenCalledTimes(1);
});
it('keeps the original overlay focus sequence, including textarea then primary button',()=>{
 document.documentElement.dataset.ui='v45';
 vi.spyOn(HTMLElement.prototype,'offsetParent','get').mockImplementation(function(this:HTMLElement){return this.parentElement;});
 render(<div onKeyDown={weiterMitEnter}><div id="ovBody"><input aria-label="TEST overlay"/><textarea aria-label="TEST multiline"/><button className="act">TEST primary</button></div></div>);
 fireEvent.keyDown(screen.getByLabelText('TEST overlay'),{key:'Enter'});
 expect(document.activeElement).toBe(screen.getByLabelText('TEST multiline'));
 // The source leaves a multiline Enter alone.
 fireEvent.keyDown(screen.getByLabelText('TEST multiline'),{key:'Enter'});
 expect(document.activeElement).toBe(screen.getByLabelText('TEST multiline'));
});
it('never enables source-only keyboard selectors when the server style marker is absent',()=>{
 const save=vi.fn();render(<div onKeyDown={weiterMitEnter}><div className="fgrid"><input aria-label="TEST off"/></div><button id="kfGo" onClick={save}>TEST save</button></div>);
 fireEvent.keyDown(screen.getByLabelText('TEST off'),{key:'Enter'});expect(save).not.toHaveBeenCalled();
});
