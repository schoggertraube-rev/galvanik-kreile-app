import {it,expect} from 'vitest';
import {CUSTOMER_INVOICE_ACTION_COPY} from '@/ui/situationCatalog';
it('keeps the actual one/many numbers and bounds only the number placeholder',()=>{
 expect(CUSTOMER_INVOICE_ACTION_COPY.numbers(['R-1'])).toBe('R-1');expect(CUSTOMER_INVOICE_ACTION_COPY.numbers(['R-1','R-2'])).toBe('R-1, R-2');
 const numbers=Array.from({length:30},(_,i)=>'R-2026-'+String(i).padStart(6,'0')),text=CUSTOMER_INVOICE_ACTION_COPY.numbers(numbers);
 expect(text.length).toBeLessThanOrEqual(120);expect(text).toMatch(/^R-2026-000000, .* und \d+ weitere$/);expect(numbers).toHaveLength(30);
 expect(CUSTOMER_INVOICE_ACTION_COPY.numbers(['R-'+ 'x'.repeat(150),'R-2']).length).toBeLessThanOrEqual(120);
});
