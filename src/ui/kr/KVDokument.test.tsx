import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {KVDokument,type KVDokumentProps} from './KVDokument';

afterEach(cleanup);
const data=():KVDokumentProps=>({quoteId:'TEST-KV',version:4,fassung:'2',originalId:'TEST-original-2',variante:'versendet',titel:'TEST KV Fassung 2',bezug:'TEST belegtes Versanddatum',
  kunde:{id:'TEST-kunde',name:'TEST Kunde',anschrift:['TEST Straße 1','TEST Ort']},
  positionen:{zustand:'bekannt',zeilen:[{id:'TEST-A',bezeichnung:'TEST 2 × Teil A',verfahren:'TEST Verfahren A',betrag:{zustand:'bekannt',text:'TEST 121 EUR'}},{id:'TEST-B',bezeichnung:'TEST 4 × Teil B',verfahren:'TEST Verfahren B',betrag:{zustand:'unbekannt',grund:'TEST Betrag B nicht belegt'}}],leerText:'TEST keine Position'},
  netto:{zustand:'unbekannt',grund:'TEST Gesamtwert nicht belegt'},termin:{zustand:'bekannt',text:'TEST belegter Termin'},gueltig:{zustand:'bekannt',text:'TEST Originalfrist'},wuensche:[{id:'TEST-wish',text:'TEST dokumentierter Wunsch'}],bedingung:'TEST Originalbedingung',laden:false});

it.each(['entwurf','versendet','neue_fassung'] as const)('%s preserves the exact original, edition and rows without deriving a missing amount',variante=>{
 const props=data(),view=render(<KVDokument {...props} variante={variante}/>);
 const document=view.container.querySelector('[data-spec-id="baustein.kv_dokument"]');
 expect(document).toHaveAttribute('data-original-id','TEST-original-2');expect(document).toHaveAttribute('data-edition','2');
 expect(screen.getByText('TEST 121 EUR')).toBeVisible();expect(screen.getByText('TEST Betrag B nicht belegt')).toBeVisible();
 expect(screen.getByText('TEST Gesamtwert nicht belegt')).toBeVisible();expect(screen.getByText('TEST Originalfrist')).toBeVisible();
 view.rerender(<KVDokument {...props} variante={variante} laden positionen={props.positionen.zustand==='bekannt'?{...props.positionen,zeilen:[...props.positionen.zeilen].reverse()}:props.positionen}/>);
 expect(document).toHaveAttribute('aria-busy','true');expect(view.container.querySelectorAll('[data-item-id]')[0]).toHaveAttribute('data-item-id','TEST-B');
 expect(screen.getByText('TEST dokumentierter Wunsch')).toBeVisible();expect(screen.queryByRole('button')).toBeNull();
});

it('retains known contact, original terms and wishes when positions cannot be read; zero rows are a separate known state',()=>{
 const props=data(),view=render(<KVDokument {...props} positionen={{zustand:'unbekannt',grund:'TEST Positionsquelle unlesbar'}}/>);
 expect(screen.getByText('TEST Positionsquelle unlesbar')).toBeVisible();expect(screen.getByText('TEST dokumentierter Wunsch')).toBeVisible();
 expect(screen.getByText('TEST Originalfrist')).toBeVisible();expect(screen.queryByText('TEST keine Position')).toBeNull();
 view.rerender(<KVDokument {...props} positionen={{zustand:'bekannt',zeilen:[],leerText:'TEST keine Position'}}/>);
 expect(screen.getByText('TEST keine Position')).toBeVisible();expect(screen.queryByText('TEST Positionsquelle unlesbar')).toBeNull();
});

it('does not reveal withheld prices and never substitutes zero or another edition',()=>{
 const props=data();if(props.positionen.zustand!=='bekannt')throw Error('TEST_KNOWN_ROWS_REQUIRED');
 const view=render(<KVDokument {...props} netto={{zustand:'verborgen'}} positionen={{...props.positionen,zeilen:props.positionen.zeilen.map(row=>({...row,betrag:{zustand:'verborgen'}}))}}/>);
 expect(screen.queryByText('TEST 121 EUR')).toBeNull();expect(screen.queryByText('TEST Betrag B nicht belegt')).toBeNull();
 expect(view.container.querySelectorAll('.sum')).toHaveLength(0);expect(screen.getByText('TEST 2 × Teil A')).toBeVisible();
 expect(screen.getByText('TEST belegter Termin')).toBeVisible();expect(view.container.textContent).not.toContain('0,00');
});
