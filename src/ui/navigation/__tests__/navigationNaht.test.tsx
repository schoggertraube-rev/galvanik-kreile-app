import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppShell,type Bereich} from '../../kr/AppShell';
import type {Geraet} from '../../kr/typen';
import {NAVIGATION} from '../register';

const expected=[
 ['tag','/',null],['nachrichten','/nachrichten','/nachrichten'],
 ['werkstatt','/warendurchlauf','/warendurchlauf'],['auftraege','/orders','/orders'],
 ['kunden','/customers','/customers'],['geld','/buchhaltung/rechnungen','/buchhaltung/rechnungen'],
 ['einstellungen','/settings','/settings'],
] as const;

describe('Nähte-b: unveränderte Büro-Navigation',()=>{
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
     onNeuerEingang={()=>{}} onWareRaus={()=>{}}
    ><section>Inhalt</section></AppShell>);
    expect(html).toMatchSnapshot();
   });
  }
 }
});
