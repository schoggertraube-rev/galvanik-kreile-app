import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {Vertiefung} from './Vertiefung';
import {BausteinVerlauf} from './BausteinVerlauf';

afterEach(cleanup);

it('omits an actually empty block instead of exposing an empty second view',()=>{
  const view=render(<Vertiefung titel="TEST Verlauf" offen={false} laden={false} deaktiviert={false} onOffen={vi.fn()}>{null}</Vertiefung>);
  expect(view.container).toBeEmptyDOMElement();
});

it('keeps the original content and expansion while pending and blocks another activation',()=>{
  const changed=vi.fn();
  const props={titel:'TEST Verlauf',offen:true,laden:false,deaktiviert:false,onOffen:changed};
  const view=render(<Vertiefung {...props}><p>TEST Originalbeleg</p></Vertiefung>);
  const summary=screen.getByText('TEST Verlauf').closest('summary')!;
  summary.focus();
  expect(summary).toHaveFocus();
  view.rerender(<Vertiefung {...props} laden><p>TEST Originalbeleg</p></Vertiefung>);
  expect(summary.closest('details')).toHaveAttribute('open');
  expect(screen.getByText('TEST Originalbeleg')).toBeVisible();
  expect(summary).toHaveAttribute('aria-disabled','true');
  expect(fireEvent.click(summary)).toBe(false);
  expect(changed).not.toHaveBeenCalled();
});

it('retains both an original and its counter-receipt without replacing either during reread',()=>{
  const entries=[{ereignisId:'TEST-original',zeit:'TEST Zeit 1',inhalt:'TEST Original'},
    {ereignisId:'TEST-counter',zeit:'TEST Zeit 2',inhalt:'TEST Gegenbeleg'}];
  const view=render(<BausteinVerlauf eintraege={entries} laden={false}/>);
  view.rerender(<BausteinVerlauf eintraege={entries} laden/>);
  expect(screen.getAllByRole('listitem').map(item=>item.dataset.eventId)).toEqual(['TEST-original','TEST-counter']);
  expect(screen.getByRole('list')).toHaveAttribute('aria-busy','true');
  expect(screen.getByText('TEST Original')).toBeVisible();
  expect(screen.getByText('TEST Gegenbeleg')).toBeVisible();
});
