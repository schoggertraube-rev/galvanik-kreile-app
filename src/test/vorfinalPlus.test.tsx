// @vitest-environment jsdom
// Explicit synthetic root presentation; the real DB/bootstrap test is package_feature_switches.
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {GlobalesPlus} from '@/ui/kr/GlobalesPlus';
afterEach(()=>{cleanup();delete document.documentElement.dataset.ui;});
it('uses the common glass button and calls the same entry callback',()=>{
 const onOpen=vi.fn();render(<GlobalesPlus onOeffnen={onOpen}/>);
 const button=screen.getByRole('button',{name:'Neu erfassen'});
 expect(button.dataset).toMatchObject({form:'quadrat',ton:'erfassung',open:'plus',specId:'navigation.plus'});
 fireEvent.click(button);expect(onOpen).toHaveBeenCalledTimes(1);
});
it('keeps the catalog label and one entry callback in the shared glass button',()=>{
 document.documentElement.dataset.ui='v45';const onOpen=vi.fn();render(<GlobalesPlus onOeffnen={onOpen}/>);
 const button=screen.getByRole('button',{name:'Neuer Eingang'});
 expect(button.dataset).toMatchObject({form:'quadrat',ton:'erfassung',open:'plus',specId:'kopf.plus'});
 expect(button.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 24 24');
 expect(button.querySelector('path')?.getAttribute('d')).toBe('M12 5v14M5 12h14');
 expect(screen.getAllByRole('button')).toHaveLength(1);
 fireEvent.click(button);expect(onOpen).toHaveBeenCalledTimes(1);
});
