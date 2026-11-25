// @vitest-environment node
import {beforeEach, expect, it, vi} from 'vitest';

const execute = vi.hoisted(() => vi.fn(async (_query:unknown) => {void _query; return [];}));
const transaction = vi.hoisted(() => vi.fn(async (work:(tx:{execute:typeof execute})=>Promise<unknown>) => work({execute})));
vi.mock('@/db', () => ({db:{transaction}}));
vi.mock('server-only', () => ({}));

import {withPrivilegedTenantTransaction, withTaktStatementTimeout} from '../privilegedDb';
import {assertPageReadBudgetActive, hasPageReadBudget, PageReadTimeout} from '@/db/readBudget';

beforeEach(() => {execute.mockClear();transaction.mockClear();});

it('begrenzt nur die Takttransaktion und gibt einen expliziten Abbruch weiter', async () => {
  const auth={tenantId:'TEST-takt'};
  expect(hasPageReadBudget()).toBe(false);
  await withPrivilegedTenantTransaction(auth, async () => undefined);
  expect(execute).toHaveBeenCalledTimes(1);
  const controller=new AbortController();
  await expect(withTaktStatementTimeout(15_000, () => withPrivilegedTenantTransaction(auth, async () => {
    expect(hasPageReadBudget()).toBe(true);
    controller.abort();
    assertPageReadBudgetActive();
  }),controller.signal)).rejects.toBeInstanceOf(PageReadTimeout);
  expect(hasPageReadBudget()).toBe(false);
});

it('weist ungültige Jobfristen vor einer SQL-Transaktion ab', async () => {
  expect(() => withTaktStatementTimeout(0, async () => undefined)).toThrow('TAKT_STATEMENT_TIMEOUT_INVALID');
  expect(transaction).not.toHaveBeenCalled();
});
