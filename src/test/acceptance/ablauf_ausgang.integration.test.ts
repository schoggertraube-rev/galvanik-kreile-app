// @vitest-environment node
import {vi} from 'vitest';
// Configuration isolation only: Actions, authorization, transactions and readers stay real.
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import '../../../e2e/ablauf/H4.spec';
import '../../../e2e/ablauf/ausgang.spec';
