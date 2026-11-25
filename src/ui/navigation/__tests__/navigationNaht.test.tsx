import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {AppShell,type Bereich} from '../../kr/AppShell';
import type {Geraet} from '../../kr/typen';
import {NAVIGATION} from '../register';

const expected=[
 ['tag','/',null],['nachrichten','/nachrichten','/nachrichten'],
 ['werkstatt','/warendurchlauf','/warendurchlauf'],['auftraege','/orders','/orders'],
 ['kunden','/customers','/customers'],['geld','/buchhaltung/rechnungen','/buchhaltung/rechnungen'],
 ['einstellungen','/settings','/settings'],
] as const;

afterEach(cleanup);

describe('Nähte-b: neues Menü mit den bestehenden Zielen',()=>{
 it('bindet jede Kennung an genau ihre bisherige Route und ihren Pfad',()=>{
  expect(NAVIGATION.map(({id,route,pfad})=>[id,route,pfad])).toEqual(expected);
  expect(NAVIGATION.filter(entry=>entry.pfad===null).map(entry=>entry.id)).toEqual(['tag']);
 });
 for(const geraet of ['desktop','tablet','handy'] as const satisfies readonly Geraet[]){
  for(const verborgen of [false,true]){
   it(`${geraet} ${verborgen?'ohne Werkstatt und Aufträge':'vollständig'}`,()=>{
    const ausgeblendet:Bereich[]=verborgen?['werkstatt','auftraege']:[];
    const html=renderToStaticMarkup(<AppShell
     geraet={geraet} variante="buero" aktiv="tag" kuerzel="GK"
     ausgeblendet={ausgeblendet}
     suche={<span>Suche</span>} plus={<span>Neu</span>}
     onNav={()=>{}} onStart={()=>{}} onKonto={()=>{}}
     onNeuerEingang={()=>{}} onWareRaus={()=>{}} onPlanung={verborgen ? undefined : ()=>{}}
    ><section>Inhalt</section></AppShell>);
    expect(html).toMatchSnapshot();
   });
  }
 }
 it('stellt den Eingang in die Mitte und ruft die vorhandenen Aktionen auf',()=>{
  const onNav=vi.fn(), onNeuerEingang=vi.fn(), onPlanung=vi.fn();
  render(<AppShell geraet="handy" variante="buero" aktiv="tag" kuerzel="GK"
    suche={null} plus={null} onNav={onNav} onStart={()=>{}} onKonto={()=>{}}
    onNeuerEingang={onNeuerEingang} onPlanung={onPlanung}><section>TEST Inhalt</section></AppShell>);
  const nav=within(screen.getByRole('navigation',{name:'Hauptnavigation'}));
  const targets=nav.getAllByRole('button');
  expect(targets).toHaveLength(5);
  expect(targets[2]).toHaveAccessibleName('Eingang');
  expect(nav.getByRole('button',{name:'Dein Tag'})).toHaveAttribute('aria-current','page');
  fireEvent.click(targets[2]);
  fireEvent.click(nav.getByRole('button',{name:'Planung'}));
  fireEvent.click(nav.getByRole('button',{name:'Mehr'}));
  expect(onNeuerEingang).toHaveBeenCalledOnce();
  expect(onPlanung).toHaveBeenCalledOnce();
  expect(onNav).toHaveBeenCalledExactlyOnceWith('mehr');
 });
 it('öffnet dieselbe Planung auch aus dem Desktop-Menü',()=>{
  const onPlanung=vi.fn();
  render(<AppShell geraet="desktop" variante="buero" aktiv="tag" kuerzel="GK"
   suche={null} plus={null} onNav={()=>{}} onStart={()=>{}} onKonto={()=>{}} onPlanung={onPlanung}
  ><section>TEST Inhalt</section></AppShell>);
  const nav=within(screen.getByRole('navigation',{name:'Hauptnavigation'}));
  fireEvent.click(nav.getByRole('button',{name:'Menü öffnen'}));
  fireEvent.click(nav.getByRole('button',{name:'Planung'}));
  expect(onPlanung).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({type:'click'}));
 });
 it('behält die Werkstattbefehle am gemeinsamen Handy-Menü und zeigt nur Öffnen als Hauptaktion',()=>{
  const onNav=vi.fn(), onAuftragOeffnen=vi.fn(), onFertigMelden=vi.fn(), onNeuerEingang=vi.fn();
  render(<AppShell geraet="handy" variante="werkstatt" aktiv="werkstatt" kuerzel="GK"
   ausgeblendet={['nachrichten','geld']} suche={null} plus={null} onNav={onNav} onStart={()=>{}} onKonto={()=>{}}
   onNeuerEingang={onNeuerEingang} onAuftragOeffnen={onAuftragOeffnen} onFertigMelden={onFertigMelden}
   ebene={werkzeuge=><div role="group" aria-label="Weitere Werkstatt-Aktionen">{werkzeuge}</div>}
  ><section>TEST Werkstatt</section></AppShell>);
  const navigation=within(screen.getByRole('navigation',{name:'Hauptnavigation'}));
  const leiste=within(screen.getByRole('navigation',{name:'Werkstatt-Aktionen'}));
  expect(leiste.getAllByRole('button')).toHaveLength(1);
  fireEvent.click(leiste.getByRole('button',{name:'Auftrag öffnen / scannen'}));
  fireEvent.click(navigation.getByRole('button',{name:'Eingang'}));
  fireEvent.click(navigation.getByRole('button',{name:'Mehr'}));
  const weitere=within(screen.getByRole('group',{name:'Weitere Werkstatt-Aktionen'}));
  expect(weitere.queryByRole('button',{name:'Mehrarbeit'})).toBeNull();
  fireEvent.click(weitere.getByRole('button',{name:'Fertig melden'}));
  expect(onAuftragOeffnen).toHaveBeenCalledOnce();
  expect(onFertigMelden).toHaveBeenCalledOnce();
  expect(onNeuerEingang).toHaveBeenCalledOnce();
  expect(onNav).toHaveBeenCalledExactlyOnceWith('mehr');
 });
});
