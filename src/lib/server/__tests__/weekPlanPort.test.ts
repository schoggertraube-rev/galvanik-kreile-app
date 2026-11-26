// @vitest-environment node
import {expect, expectTypeOf, it, vi} from 'vitest';

const fixtures = vi.hoisted(() => ({
  person: {id: 'test-meister', rolle: 'meister', name: 'TEST Meister', is_test: true},
  execute: vi.fn(),
  tenant: vi.fn(),
}));

vi.mock('@/lib/server/privilegedDb', () => ({
  withPrivilegedTenantTransaction: (context: {tenantId: string}, work: (tx: unknown) => unknown) => {
    fixtures.tenant(context.tenantId);
    return work({execute: fixtures.execute});
  },
}));

import {readWeekPlan} from '../weekPlanPort';

it('reads one ISO week, omits operating closures and leaves absences explicitly unavailable', async () => {
  expectTypeOf(readWeekPlan).parameters.toEqualTypeOf<[tenantId: string, isoWeek: string]>();
  fixtures.execute.mockResolvedValueOnce([{betriebsruhe: ['2026-11-24']}])
    .mockResolvedValueOnce([{id: fixtures.person.id, rolle: fixtures.person.rolle}]);

  await expect(readWeekPlan('TEST-ablauf-wochenplan', '2026-W48')).resolves.toEqual({
    woche: '2026-W48',
    personen: [{id: 'test-meister', rolle: 'meister',
      arbeitstage: ['2026-11-23', '2026-11-25', '2026-11-26', '2026-11-27'], abwesenheiten: []}],
    abwesenheitQuelle: 'fehlt',
  });
  expect(fixtures.tenant).toHaveBeenCalledWith('TEST-ablauf-wochenplan');
  expect(fixtures.execute).toHaveBeenCalledTimes(2);
});
