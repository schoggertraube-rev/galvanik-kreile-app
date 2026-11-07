import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import {MoreMenu} from '../MoreMenu';
const state=vi.hoisted(()=>({path:'/',replace:vi.fn(),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({usePathname:()=>state.path,useRouter:()=>({replace:state.replace,refresh:state.refresh})}));
vi.mock('next/link',()=>({default:({href,onNavigate,children,...props}:{href:string;onNavigate?:()=>void;children:ReactNode;prefetch?:boolean})=>{const{prefetch:_,...rest}=props;void _;return <a href={href} {...rest} onClick={event=>{event.preventDefault();onNavigate?.();}}>{children}</a>;}}));
vi.mock('@/app/actions/auth',()=>({logout:vi.fn()}));
vi.mock('@/lib/auth/PermissionsContext',()=>({usePermissions:()=>({status:'authenticated',hasPermission:()=>true,hasArea:()=>true})}));
vi.mock('../GlobalCreateFlow',()=>({requestGlobalCreate:vi.fn()}));
afterEach(()=>{cleanup();state.path='/';vi.clearAllMocks();});
describe('Mehr menu route completion',()=>{
 it('keeps a settings navigation mounted until the pathname confirms the destination',()=>{
  const close=vi.fn();const view=render(<MoreMenu open onClose={close}/>);
  const link=screen.getByRole('link',{name:'Einstellungen'});
  expect(link).toHaveAttribute('href','/settings');
  expect(fireEvent.click(link)).toBe(true);
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole('link',{name:'Einstellungen'})).toBeInTheDocument();
  state.path='/settings';view.rerender(<MoreMenu open onClose={close}/>);
  expect(close).toHaveBeenCalledTimes(1);
 });
 it('can close immediately when the requested page is already current',()=>{
  state.path='/settings';const close=vi.fn();render(<MoreMenu open onClose={close}/>);
  fireEvent.click(screen.getByRole('link',{name:'Einstellungen'}));
  expect(close).toHaveBeenCalledTimes(1);
 });
});
