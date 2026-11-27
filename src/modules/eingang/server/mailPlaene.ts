import 'server-only';

import {erlaubteWirkung,type MailAnliegen,type MailWirkung,type MailWirkungsKontext} from './mailWirkungen';

/** Der Vorschlag liefert nur bestätigte Wirkungen. Ausführen übernimmt die bestehende Warteschlange. */
export function planeMailWirkungen(anliegen:MailAnliegen,gewuenscht:readonly MailWirkung[],kontext:MailWirkungsKontext){
  return [...new Set(gewuenscht)].filter(wirkung=>erlaubteWirkung(anliegen,wirkung,kontext));
}
