import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {V45_TEXT} from '@/ui/situationCatalog';
import {Fehler,type FehlerSituation} from './Fehler';

afterEach(()=>{cleanup();delete document.documentElement.dataset.ui;});

const cases:[FehlerSituation,(values:{gegenstand:string;ausweg:string})=>string][]=[
  ['offline',V45_TEXT.error$offline],['server',V45_TEXT.error$server],
  ['conflict',V45_TEXT.error$conflict],['permission',V45_TEXT.error$permission],
  ['empty',V45_TEXT.error$empty],['mailbox',V45_TEXT.error$mailbox],
  ['send_unknown',V45_TEXT.error$send_unknown],['save',V45_TEXT.error$save],
];

it.each(cases)('%s keeps object, catalog wording and exactly one exit through loading', (situation,text)=>{
  document.documentElement.dataset.ui='v45';
  const exit=vi.fn(),values={gegenstand:'TEST Original',ausweg:'TEST Lade den Beleg neu.'};
  const props={situation,...values,objektId:'TEST-original',laden:false,deaktiviert:false,
    aktion:{id:'ui.reload',text:'TEST Beleg neu laden',onAusloesen:exit}};
  const view=render(<Fehler {...props}/>);
  expect(screen.getByRole('status')).toHaveTextContent(text(values));
  expect(screen.getAllByRole('button')).toHaveLength(1);
  const button=screen.getByRole('button',{name:props.aktion.text});
  expect(button).toHaveClass('btn2');
  view.rerender(<Fehler {...props} laden/>);
  fireEvent.click(button);
  expect(exit).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent(text(values));
  view.rerender(<Fehler {...props}/>);
  button.focus();expect(button).toHaveFocus();
  fireEvent.click(button);
  expect(exit).toHaveBeenCalledTimes(1);
});

it('keeps the existing legacy button while the shared style switch is off',()=>{
  render(<Fehler situation="save" gegenstand="TEST Original" ausweg="TEST Lade neu."
    objektId="TEST-original" laden={false} deaktiviert={false}
    aktion={{id:'ui.reload',text:'TEST Neu laden',onAusloesen:vi.fn()}}/>);
  const button=screen.getByRole('button');
  expect(button).toHaveClass('kr-btn');
  expect(button).not.toHaveClass('btn2');
  expect(button).not.toHaveAttribute('data-glass');
});
