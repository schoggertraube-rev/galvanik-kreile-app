import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {Suchtreffer} from './Suchtreffer';
import type {SuchTreffer} from './Suche';

afterEach(cleanup);

it('keeps all ambiguous results and opens only the explicitly chosen real target after reorder',()=>{
  const first=vi.fn(),second=vi.fn();
  const hits:SuchTreffer[]=[
    {key:'TEST-A',id:'TEST-A',titel:'TEST Kunde A',grund:'TEST gleiche Nummer',quelle:'Kunde',onOeffnen:first},
    {key:'TEST-B',id:'TEST-B',titel:'TEST Kunde B',grund:'TEST gleicher Name',quelle:'Kunde',onOeffnen:second},
  ];
  const props={treffer:hits,selectedKey:'TEST-B',laden:false,deaktiviert:false,leer:null};
  const view=render(<Suchtreffer {...props}/>);
  expect(first).not.toHaveBeenCalled();expect(second).not.toHaveBeenCalled();
  expect(screen.getAllByRole('button')).toHaveLength(2);
  view.rerender(<Suchtreffer {...props} treffer={[hits[1],hits[0]]} laden/>);
  expect(screen.getAllByRole('button')).toHaveLength(2);
  const chosen=screen.getByRole('button',{name:/TEST Kunde B/});
  expect(chosen).toHaveClass('sel');
  fireEvent.click(chosen);
  expect(second).not.toHaveBeenCalled();
  view.rerender(<Suchtreffer {...props} treffer={[hits[1],hits[0]]}/>);
  chosen.focus();expect(chosen).toHaveFocus();
  fireEvent.click(chosen);
  expect(first).not.toHaveBeenCalled();expect(second).toHaveBeenCalledTimes(1);
});

it('keeps the supplied empty-state exit instead of manufacturing a match',()=>{
  const exit=vi.fn();
  render(<Suchtreffer treffer={[]} selectedKey={null} laden={false} deaktiviert={false}
    leer={<button onClick={exit}>TEST Eingang öffnen</button>}/>);
  fireEvent.click(screen.getByRole('button',{name:'TEST Eingang öffnen'}));
  expect(exit).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole('button')).toHaveLength(1);
});
