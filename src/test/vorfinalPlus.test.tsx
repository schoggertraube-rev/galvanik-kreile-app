// @vitest-environment jsdom
// Explicit synthetic flag boundaries; the real DB/bootstrap test is package_feature_switches.
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {GlobalesPlus} from '@/ui/kr/GlobalesPlus';
const boundary=vi.hoisted(()=>({enabled:false}));
vi.mock('@/lib/auth/PermissionsContext',()=>({usePermissions:()=>({packageSwitches:{ui_v45:boundary.enabled}})}));
afterEach(cleanup);
it('keeps the old button while off and calls the same real entry callback',()=>{
 boundary.enabled=false;const onOpen=vi.fn();render(<GlobalesPlus onOeffnen={onOpen}/>);
 const button=screen.getByRole('button',{name:'Neu erfassen'});
 expect(button.className).toBe('kr-plus');fireEvent.click(button);expect(onOpen).toHaveBeenCalledTimes(1);
});
it('ports the exact vorfinal plus markup, icon and catalog label without a second action',()=>{
 boundary.enabled=true;const onOpen=vi.fn();render(<GlobalesPlus onOeffnen={onOpen}/>);
 const button=screen.getByRole('button',{name:'Neuer Eingang'});
 expect(button.className).toBe('plus');
 expect(button.dataset).toMatchObject({glass:'act',tint:'plus',open:'plus',specId:'kopf.plus'});
 expect(button.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 24 24');
 expect(button.querySelector('path')?.getAttribute('d')).toBe('M12 5v14M5 12h14');
 expect(screen.getAllByRole('button')).toHaveLength(1);
 fireEvent.click(button);expect(onOpen).toHaveBeenCalledTimes(1);
});
