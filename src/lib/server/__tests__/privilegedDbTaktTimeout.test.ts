// @vitest-environment node
import {beforeEach, expect, it, vi} from 'vitest';

const execute = vi.hoisted(() => vi.fn(async (_query:unknown) => {void _query; return [];}));
const transaction = vi.hoisted(() => vi.fn(async (work:(tx:{execute:typeof execute})=>Promise<unknown>) => work({execute})));
vi.mock('@/db', () => ({db:{transaction}}));
vi.mock('server-only', () => ({}));

import {withPrivilegedTenantTransaction, withTaktStatementTimeout} from '../privilegedDb';

beforeEach(() => {execute.mockClear();transaction.mockClear();});

it('setzt das SQL-Zeitlimit nur innerhalb eines Taktjobs transaktionslokal', async () => {
  const auth={tenantId:'TEST-takt'};
  await withPrivilegedTenantTransaction(auth, async () => undefined);
  expect(execute).toHaveBeenCalledTimes(1);
  execute.mockClear();
  await withTaktStatementTimeout(15_000, () => withPrivilegedTenantTransaction(auth, async () => undefined));
  expect(execute).toHaveBeenCalledTimes(2);
  const timeout=JSON.stringify(execute.mock.calls[1][0]);
  expect(timeout).toContain('statement_timeout');
  expect(timeout).toContain('15000ms');
  expect(timeout).toContain('true');
  execute.mockClear();
  await withPrivilegedTenantTransaction(auth, async () => undefined);
  expect(execute).toHaveBeenCalledTimes(1);
});

it('weist ungültige Jobfristen vor einer SQL-Transaktion ab', async () => {
  expect(() => withTaktStatementTimeout(0, async () => undefined)).toThrow('TAKT_STATEMENT_TIMEOUT_INVALID');
  expect(transaction).not.toHaveBeenCalled();
});
