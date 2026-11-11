import {it,expect} from 'vitest';
import {CUSTOMER_COLLECTION_COPY as copy} from './situationCatalog';
it('PL K8 customer sentences omit missing facts rather than inventing dates, reminders or money',()=>{
 const missing=copy.render('E4',{name:'Kunde',company:'Firma',members:[{number:'A',quantity:2,finishedDate:'2026-11-01'}],deadline:'2026-11-30'});
 expect(missing.subject).toBe('Lagerfrist für Ihre Teile aus Auftrag A');expect(missing.body).toContain('Ihre 2 Teile aus Auftrag A liegen seit 01.11.2026 zur Abholung bereit.');expect(missing.body).not.toContain('Wir haben');expect(missing.body).not.toContain('Lagergeld');expect(missing.body).not.toContain('Offen sind');
 const full=copy.render('E4',{members:[{number:'A',quantity:2,finishedDate:'2026-11-01',e1Date:'2026-11-03',e2Date:'2026-11-04',callDate:'2026-11-05'}],storageAmount:'10,00 €',storageUnit:'Woche'});expect(full.body).toContain('Wir haben Sie am 03.11.2026 und 04.11.2026 erinnert und am 05.11.2026 versucht, Sie telefonisch zu erreichen.');expect(full.body).toContain('Danach berechnen wir Lagergeld von 10,00 € je Woche.');expect(full.body).not.toContain('Guten Tag');
 expect(copy.render('E1',{members:[{number:'A'}]}).body).toBe('');expect(copy.render('E2',{members:[{number:'A',quantity:1,finishedDate:'2026-11-01'}],openAmount:'5,00 €'}).body).toContain('Offen sind 5,00 €; bitte bringen Sie den Betrag zur Abholung mit.');
});
