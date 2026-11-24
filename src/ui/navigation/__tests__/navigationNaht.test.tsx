import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppShell,type Bereich} from '../../kr/AppShell';
import type {Geraet} from '../../kr/typen';

describe('Nähte-b: unveränderte Büro-Navigation',()=>{
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
