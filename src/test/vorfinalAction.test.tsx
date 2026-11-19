// @vitest-environment jsdom
// Explicit synthetic display boundaries; existing callbacks, never simulated product success.
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Button} from '@/ui/kr/Button';
import {weiterMitEnter} from '@/ui/kr/tastatur';
afterEach(()=>{cleanup();delete document.documentElement.dataset.ui;vi.restoreAllMocks();});
it('keeps the existing primary markup off and copies the source act default when on',()=>{
 const command=vi.fn();const view=render(<Button art="primaer" text="TEST save" onClick={command}/>);
 expect(screen.getByRole('button').className).toBe('kr-btn kr-btn--primaer');
 document.documentElement.dataset.ui='v45';view.rerender(<Button art="primaer" text="TEST save" onClick={command}/>);
 const button=screen.getByRole('button',{name:'TEST save'});
 expect(button.className).toBe('act');expect(button.dataset).toMatchObject({glass:'act',tint:'go'});
 expect(button.querySelector('.lbl')?.textContent).toBe('TEST save');
 expect(button.querySelector('.nub .ic path')?.getAttribute('d')).toBe('M5 12h14M13 6l6 6-6 6');
 expect(button.querySelector('.okmark path')?.getAttribute('d')).toBe('m5 12.5 4.5 4.5L19 7.5');
 fireEvent.click(button);expect(command).toHaveBeenCalledTimes(1);expect(button.classList.contains('done')).toBe(false);
});
it('retains the existing disabled state and escapes actual flow text',()=>{
 document.documentElement.dataset.ui='v45';const command=vi.fn();render(<Button art="erledigen" text={'TEST <img src=x>'} disabled onClick={command}/>);
 const button=screen.getByRole('button');fireEvent.click(button);expect(command).not.toHaveBeenCalled();
 expect(button.querySelector('img')).toBeNull();expect(button.textContent).toBe('TEST <img src=x>');
});
it('feeds the same primary command from the existing form Enter handler',()=>{
 document.documentElement.dataset.ui='v45';const command=vi.fn();
 vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{width:100,height:48}] as unknown as DOMRectList);
 render(<div onKeyDown={weiterMitEnter}><form><input aria-label="TEST required" required/><div className="kr-dialog-fuss"><Button art="erledigen" text="TEST command" onClick={command}/></div></form></div>);
 fireEvent.keyDown(screen.getByLabelText('TEST required'),{key:'Enter'});expect(command).toHaveBeenCalledTimes(1);
});
