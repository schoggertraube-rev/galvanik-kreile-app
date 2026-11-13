// @vitest-environment node
import {it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {runQuoteQuantityCase} from '../../../e2e/ablauf/quoteQuantityCase';

const cases=[
 {name:'A07-1 full F2',quantity:10,received:10,total:4000,expected:4000,hours:'0.5000',operational:false,fixed:0},
 {name:'A07-2 partial F2',quantity:10,received:6,total:4000,expected:2400,hours:'0.3000',operational:false,fixed:0},
 {name:'A07-8 excess F2',quantity:10,received:12,total:4000,expected:4800,hours:'0.6000',operational:false,fixed:0},
 {name:'A07-7 without money right',quantity:10,received:6,total:4000,expected:2400,hours:'0.3000',operational:true,fixed:0},
 {name:'A07-2b two thirds',quantity:3,received:2,total:1000,expected:667,hours:null,operational:false,fixed:0},
 {name:'A07-2b one third',quantity:3,received:1,total:1000,expected:333,hours:null,operational:false,fixed:0},
];
it.each(cases)('$name preserves the accepted edition, real received quantity and exact cents through reload',runQuoteQuantityCase);
