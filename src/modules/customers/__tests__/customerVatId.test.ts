import {expect,it} from 'vitest';
import {customerFieldError,EMPTY_CUSTOMER_FORM} from '../customerFormContract';
it('K1 applies the same approved VAT-prefix format to domestic and foreign customer form values without changing them',()=>{
 for(const country of ['DE','AT','andere'] as const){
  for(const vatId of ['','DE123456789','ATU12345678','AT U12345678'])expect(customerFieldError('vatId',{...EMPTY_CUSTOMER_FORM,country,vatId})).toBeNull();
  for(const vatId of ['123456789','123/456/789','atU12345678'])expect(customerFieldError('vatId',{...EMPTY_CUSTOMER_FORM,country,vatId})).toBe('USt-ID prüfen');
 }
 expect(EMPTY_CUSTOMER_FORM.vatId).toBe('');
});
