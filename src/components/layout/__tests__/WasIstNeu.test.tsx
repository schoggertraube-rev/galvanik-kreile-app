import {act,cleanup,fireEvent,render as renderWithoutRoot,screen,within} from '@testing-library/react';
import type {ReactElement} from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {WasIstNeu} from '../WasIstNeu';
import entries from '@/content/was-ist-neu.json';

beforeEach(()=>{localStorage.clear();vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:()=>{},removeEventListener:()=>{}} as unknown as MediaQueryList)));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
const props={loginHandle:'synthetic-public-login-A',geraet:'desktop' as const,onNavigate:vi.fn(()=>true)};
const render=(element:ReactElement)=>renderWithoutRoot(<div className="kr-app">{element}</div>);
describe('AP-NEU P52 reading marker and real navigation boundary',()=>{
 it('keeps one login reading marker separate from another and shows newest entries first',()=>{
  const first=render(<WasIstNeu {...props}/>);expect(screen.getByRole('button',{name:/Was ist neu/})).toHaveTextContent(String(entries.length));
  fireEvent.click(screen.getByRole('button',{name:/Was ist neu/}));expect(screen.getByRole('dialog',{name:'Was ist neu'})).toBeVisible();
  expect(screen.getByRole('dialog').parentElement?.className).toContain('kr-ebene');
  expect(screen.getByRole('dialog').closest('.kr-app')).toBe(first.container.firstElementChild);
  expect(document.body.querySelectorAll('.kr-app')).toHaveLength(1);
  expect(screen.getByRole('button',{name:/^Was ist neu(?: · \d+ ungelesen)?$/})).not.toHaveTextContent(String(entries.length));
  expect(within(screen.getByRole('dialog')).getAllByRole('heading',{level:3})[0]).toHaveTextContent('#168');
  const marker=localStorage.getItem('kreile:was-ist-neu:synthetic-public-login-A');expect(marker).toBeTruthy();first.unmount();
  render(<WasIstNeu {...props} loginHandle="synthetic-public-login-B"/>);expect(screen.getByRole('button',{name:/Was ist neu/})).toHaveTextContent(String(entries.length));
  expect(localStorage.getItem('kreile:was-ist-neu:synthetic-public-login-B')).toBeNull();
 });
 it('uses the canonical requested target and closes after navigation, while an unavailable future target stays visible',()=>{
  const navigate=vi.fn(()=>false);render(<WasIstNeu {...props} onNavigate={navigate}/>);fireEvent.click(screen.getByRole('button',{name:/Was ist neu/}));
  fireEvent.click(screen.getByRole('button',{name:/Vorschau: Nachrichten lassen/}));expect(navigate).toHaveBeenCalledWith('/nachrichten');
  expect(screen.getByText(/in diesem Stand noch nicht freigegeben/)).toBeVisible();expect(screen.getByRole('dialog')).toBeVisible();
  navigate.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:/Vorschau: Nachrichten lassen/}));expect(screen.queryByRole('dialog')).toBeNull();
 });
 it('keeps the header usable with blocked storage and counts only the last seven days',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new DOMException('blocked','SecurityError');});
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('blocked','SecurityError');});
  const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
  render(<WasIstNeu {...props} geraet="handy"/>);const trigger=screen.getByRole('button',{name:'Was ist neu'});expect(trigger).toBeEnabled();expect(trigger).not.toHaveTextContent(/\d/);
  fireEvent.click(trigger);expect(screen.getByRole('dialog')).toBeVisible();expect(screen.getByText('In den letzten sieben Tagen gibt es keine neuen Einträge.')).toBeVisible();expect(screen.queryByRole('heading',{level:3})).toBeNull();expect(warning).toHaveBeenCalledWith('[WHAT_NEW_STORAGE_WRITE_FAILED]',expect.any(Object));
 });
 it('handles a write-only storage failure without repeating unread entries during this visit',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('full','QuotaExceededError');});
  vi.spyOn(console,'warn').mockImplementation(()=>{});render(<WasIstNeu {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:/Was ist neu/}));
  expect(screen.getByRole('button',{name:'Was ist neu'})).not.toHaveTextContent(/\d/);
  expect(screen.getByRole('dialog')).toBeVisible();expect(localStorage.getItem('kreile:was-ist-neu:synthetic-public-login-A')).toBeNull();
 });
 it('observes storage clearing and restores unread entries without any server write',()=>{
  render(<WasIstNeu {...props}/>);fireEvent.click(screen.getByRole('button',{name:/Was ist neu/}));
  expect(screen.queryByText(String(entries.length),{selector:'[data-spec-id="app.was-ist-neu.anzahl"]'})).toBeNull();
  act(()=>{localStorage.clear();window.dispatchEvent(new StorageEvent('storage',{key:null}));});
  expect(screen.getByRole('button',{name:/^Was ist neu(?: · \d+ ungelesen)?$/})).toHaveTextContent(String(entries.length));
 });
});
