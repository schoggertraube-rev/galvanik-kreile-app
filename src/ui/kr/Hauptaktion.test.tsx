import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {Hauptaktion} from './Hauptaktion';

afterEach(()=>{cleanup();delete document.documentElement.dataset.ui;});

describe('S19 source-bound Hauptaktion',()=>{
  it('keeps the real label/context while loading and exposes the same callback after reread',()=>{
    document.documentElement.dataset.ui='v45';
    const command=vi.fn();
    const props={elementId:'order.collect',text:'TEST Auftrag zur Sammelrechnung vormerken',laden:false,gesperrt:false,onAusloesen:command};
    const view=render(<Hauptaktion {...props}/>);
    const button=screen.getByRole('button',{name:props.text});
    expect(button).toHaveClass('act');
    expect(button.querySelector('.lbl')).toHaveTextContent(props.text);
    expect(button.querySelector('.nub .ic')).not.toBeNull();
    expect(button.querySelector('.okmark')).not.toBeNull();
    fireEvent.click(button);
    expect(command).toHaveBeenCalledTimes(1);
    view.rerender(<Hauptaktion {...props} laden/>);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy','true');
    fireEvent.click(button);
    expect(command).toHaveBeenCalledTimes(1);
    expect(button).toHaveTextContent(props.text);
    view.rerender(<Hauptaktion {...props}/>);
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(command).toHaveBeenCalledTimes(2);
  });

  it('retains the supplied blocking reason visibly and never invokes a blocked command',()=>{
    const command=vi.fn();
    render(<Hauptaktion elementId="order.collect" text="TEST Auftrag vormerken"
      laden={false} gesperrt grund="TEST Original fehlt" onAusloesen={command}/>);
    const button=screen.getByRole('button',{name:'TEST Auftrag vormerken'});
    expect(screen.getByText('TEST Original fehlt')).toBeVisible();
    expect(button).toHaveAccessibleDescription('TEST Original fehlt');
    fireEvent.click(button);
    expect(command).not.toHaveBeenCalled();
  });
});
