// @vitest-environment node
// Use the existing real Replay-DB acceptance CI job; no second test implementation.
import {vi} from 'vitest';
// Configuration isolation only; the real session, rights, actions and DB are untouched.
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import '../../../e2e/ablauf/H1.spec';
import '../../../e2e/ablauf/H2.spec';
import '../../../e2e/ablauf/H3.spec';
import '../../../e2e/ablauf/H4.spec';
import '../../../e2e/ablauf/H5.spec';
import '../../../e2e/ablauf/H6.spec';
import '../../../e2e/ablauf/H7.spec';
import '../../../e2e/ablauf/H8.spec';
import '../../../e2e/ablauf/ausgang.spec';
