// @vitest-environment node
import {it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {runQuoteQuantityCase} from '../../../e2e/ablauf/quoteQuantityCase';

// PL13Nov21:45 confirms this exact 2400-cent expectation; no skipped test or guard bypass.
it('A07-2 nonzero setup and material',()=>runQuoteQuantityCase({name:'A07-2 nonzero setup and material',quantity:10,received:6,total:4000,expected:2400,hours:'0.3000',operational:false,fixed:500}));
