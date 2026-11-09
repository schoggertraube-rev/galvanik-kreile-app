// @vitest-environment node
// The unchanged H8 action/DB/readback test is shared with the diagnostic branch.
import {vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import '../../../e2e/ablauf/H8.spec';
