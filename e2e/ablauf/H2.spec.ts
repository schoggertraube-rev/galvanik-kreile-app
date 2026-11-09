import {it} from 'vitest';
import {requestMailStep} from './requestMailStep';

// H2 shares H1's mail-to-quote prefix before its cash/pickup branch.
it('H2 Abholung bar / step1 T25: actual request mail becomes kv_anfrage',async()=>{await requestMailStep('H2');});
