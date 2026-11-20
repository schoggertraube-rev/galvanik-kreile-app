import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {Lage,type LageTon} from './Lage';

afterEach(cleanup);

it.each<[LageTon,string]>([['succ','ok'],['warn','warn'],['ral','ral'],['info','calm']])(
  'retains the %s fact, source tone and non-colour cue while rereading', (zustand,tone)=>{
    const view=render(<Lage zustand={zustand} text="TEST belegter Zustand" laden={false}/>);
    const fact=screen.getByText('TEST belegter Zustand');
    view.rerender(<Lage zustand={zustand} text="TEST belegter Zustand" laden/>);
    expect(fact).toHaveAttribute('data-tone',tone);
    expect(fact).toHaveAttribute('aria-busy','true');
    expect(fact.querySelector('svg')).not.toBeNull();
    expect(fact).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('button')).toBeNull();
  });
