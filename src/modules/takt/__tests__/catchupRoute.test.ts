// @vitest-environment node
import {beforeEach, expect, it, vi} from 'vitest';

const scheduled = vi.hoisted(() => ({callbacks: [] as (() => Promise<unknown>)[]}));
const catchup = vi.hoisted(() => vi.fn());
const home = vi.hoisted(() => vi.fn());
vi.mock('next/server', () => ({after: (callback: () => Promise<unknown>) => scheduled.callbacks.push(callback)}));
vi.mock('../server-public', () => ({holeTaktNach: catchup}));
vi.mock('@/app/actions/orders.actions', () => ({readTodayHomeRevision: vi.fn(), readTodayHomePart: vi.fn()}));
vi.mock('@/lib/server/authBootstrap', () => ({readCacheLoginScope: vi.fn(async () => 'test-scope')}));
vi.mock('@/lib/server/authorization', () => ({
  resolveAuthorization: vi.fn(async () => ({ok: true, data: {tenantId: 'test-tenant'}})),
  hasAnyAuthorizationArea: vi.fn(() => true),
}));
vi.mock('@/lib/server/officeHomeRead', () => ({loadOfficeHome: home}));
vi.mock('@/db/readBudget', () => ({
  withPageReadBudget: (work: () => Promise<unknown>) => work(),
  outsidePageReadBudget: (work: () => Promise<unknown>) => work(),
}));
import {GET} from '@/app/api/heute/modell/route';

beforeEach(() => {
  scheduled.callbacks = [];
  catchup.mockReset();
  home.mockReset();
  home.mockResolvedValue({dashboard: {code: 'OK'}, modelRead: {revision: 'a'.repeat(64)}});
  catchup.mockResolvedValue(true);
});

it('antwortet vor dem Nachholen mit unverändertem Modell und ETag', async () => {
  const response = await GET(new Request('https://example.test/api/heute/modell?nur=veraltet'));
  expect(response.status).toBe(200);
  expect(response.headers.get('ETag')).toBe(`"${'a'.repeat(64)}"`);
  expect((await response.json()).code).toBe('OK');
  expect(scheduled.callbacks).toHaveLength(1);
  expect(catchup).not.toHaveBeenCalled();
  await scheduled.callbacks[0]();
  expect(catchup).toHaveBeenCalledOnce();
  expect(catchup).toHaveBeenCalledWith('test-tenant');
});

it('verändert die Leseantwort auch bei fehlgeschlagenem Nachholen nicht', async () => {
  catchup.mockRejectedValueOnce(Error('TEST_CATCHUP_FAILED'));
  const response = await GET(new Request('https://example.test/api/heute/modell?nur=veraltet'));
  expect(response.status).toBe(200);
  expect((await response.json()).code).toBe('OK');
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try { await scheduled.callbacks[0](); }
  finally { error.mockRestore(); }
  expect(catchup).toHaveBeenCalledOnce();
});
