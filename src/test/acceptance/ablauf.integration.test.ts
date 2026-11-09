// @vitest-environment node
// Targeted due-date Replay proof: both handovers and a late retry. Not the complete H8 chain.
import {vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import '../../../e2e/ablauf/H8.spec';
