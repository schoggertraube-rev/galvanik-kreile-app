import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RightNav } from '@/components/layout/RightNav';
import { OrdersAppAdapter } from '@/app/orders/OrdersAppAdapter';

const ports=vi.hoisted(()=>({go:vi.fn(),base:vi.fn(),full:vi.fn(),track:vi.fn()}));
vi.mock('next/navigation',()=>({usePathname:()=>'/'}));
vi.mock('next/link',()=>({default:({href,children,onClick,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>&{href:string})=><a href={href} {...props} onClick={event=>{onClick?.(event);event.preventDefault();window.history.pushState({},'',href);ports.go(href);}}>{children}</a>}));
vi.mock('@/app/actions/orders.actions',()=>({getOrdersBaseDb:ports.base,getOrdersDb:ports.full}));
vi.mock('@/lib/auth/PermissionsContext',()=>({usePermissions:()=>({hasPermission:()=>true,role:'admin',loading:false,offline24h:false,offlineScope:null})}));
vi.mock('@/lib/tracking/tracking',()=>({trackUiEvent:ports.track}));
vi.mock('@/lib/overlayStore',()=>({useOverlayStore:(select:(state:{openOrder:()=>void;openCustomer:()=>void})=>unknown)=>select({openOrder:vi.fn(),openCustomer:vi.fn()})}));
vi.mock('@/components/layout/GlobalCreateFlow',()=>({requestGlobalCreate:vi.fn()}));

function NavigationHarness(){
  const [path,setPath]=useState('/');
  ports.go.mockImplementation(setPath);
  return <><RightNav/>{path==='/orders'?<OrdersAppAdapter/>:null}</>;
}

beforeEach(()=>{
  vi.clearAllMocks();
  window.history.replaceState({},'','/');
  Object.defineProperty(window,'matchMedia',{configurable:true,value:()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})});
  ports.base.mockResolvedValue({ok:true,data:[{id:'TEST-order',version:1,orderNumber:'TEST-A-1',customerId:'TEST-customer',customerName:'TEST Kunde',title:'Teil',task:null,itemDescription:'Teil',surfaceRequested:null,station:'angenommen',status:'angenommen',statusText:'IM PLAN',risk:'green',currentStationId:'angenommen',parts:[],intakeDate:'2026-11-20',dueDate:'2026-11-27',dueValue:'27.11.2026',createdAt:'2026-11-20T08:00:00Z'}]});
  ports.full.mockReturnValue(new Promise(()=>{}));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});

it('opens /orders with the base list while the Today request is still pending',async()=>{
  const todayFetch=vi.fn(()=>new Promise<Response>(()=>{}));
  vi.stubGlobal('fetch',todayFetch);
  void fetch('/api/heute/modell?nur=veraltet');
  render(<NavigationHarness/>);
  fireEvent.mouseEnter(screen.getByRole('complementary'));
  fireEvent.click(screen.getByRole('link',{name:'Aufträge'}));
  expect(ports.go).toHaveBeenCalledWith('/orders');
  expect(window.location.pathname).toBe('/orders');
  const row=await screen.findByRole('group',{name:'Auftrag TEST-A-1'});
  expect(row).toHaveTextContent('TEST Kunde');
  expect(row).toHaveTextContent('Angenommen');
  expect(row).toHaveTextContent('27.11.2026');
  expect(todayFetch).toHaveBeenCalledTimes(1);
});
