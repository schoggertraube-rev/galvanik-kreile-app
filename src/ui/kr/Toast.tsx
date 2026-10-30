import { Icon } from './Icon';
import { Button } from './Button';
export interface ToastProps { text: string; aktion?: { text: string; onClick: () => void }; }
/** Rückmeldung nach Aktion, 3–5 s, optional genau eine Aktion (Rückgängig/Korrigieren) */
export function Toast({ text, aktion }: ToastProps) {
  return <div className="kr-toast" role="status"><Icon name="check" /><span>{text}</span>{aktion && <Button text={aktion.text} onClick={aktion.onClick} />}</div>;
}
