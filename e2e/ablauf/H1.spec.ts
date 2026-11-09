import {it} from 'vitest';
import {requestMailStep} from './requestMailStep';

// Prefix stops at the first red boundary; not a full H1 PASS.
it('H1 Versand Vorkasse / step1 T25: actual request mail becomes kv_anfrage',async()=>{await requestMailStep('H1');});
