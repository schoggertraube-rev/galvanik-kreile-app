import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/server/marketingAuthorization', () => ({
  requireMarketingRead: mocks.read,
  requireMarketingWrite: mocks.write,
}))
vi.mock('@/db', () => ({ db: {
  select: mocks.select,
  insert: mocks.insert,
  update: mocks.update,
  transaction: mocks.transaction,
} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import * as studio from '@/app/marketing/marketing.actions'
import * as analysis from '@/app/marketing/analysis.actions'
import * as attribution from '@/app/marketing/attribution/actions'
import * as channels from '@/app/marketing/kanaele/actions'
import * as actions from '@/app/marketing/aktion/actions'
import * as segments from '@/app/marketing/segmente/actions'
import * as consents from '@/app/marketing/einwilligungen/actions'

describe('marketing Server Action authorization boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.read.mockRejectedValue(new Error('AUTH_ERROR: Forbidden'))
    mocks.write.mockRejectedValue(new Error('AUTH_ERROR: Forbidden'))
  })

  it('rejects all read and write entry points before database or form work', async () => {
    const emptyForm = new FormData()
    const calls: (() => Promise<unknown>)[] = [
      () => studio.getBesteAktionAction(),
      () => studio.listVorschlaegeAction(),
      () => studio.getKampagnenAction(),
      () => studio.getSegmenteAction(),
      () => studio.getLernInsightsAction(),
      () => studio.getWirkungMiniAction(),
      () => studio.getFunnelAction(),
      () => studio.getStoryIdeenAction(),
      () => analysis.getMarketingAnfragenAnalysisAction('invalid', 'invalid'),
      () => analysis.getMarketingUmsatzAnalysisAction('invalid', 'invalid'),
      () => analysis.getMarketingRoiAnalysisAction('invalid', 'invalid'),
      () => attribution.getAttributionData(),
      () => channels.getKanaele(),
      () => channels.updateKanalConfig('channel', false, {}),
      () => actions.getAktionen(),
      () => actions.getAktionById('action'),
      () => actions.createAktion(emptyForm),
      () => actions.changeAktionStatus('action', 'ausgefuehrt'),
      () => segments.getSegments(),
      () => segments.getSegmentById('segment'),
      () => segments.createSegment(emptyForm),
      () => segments.updateSegment('segment', emptyForm),
      () => segments.deleteSegment('segment'),
      () => consents.getEinwilligungen(),
      () => consents.checkEinwilligung('customer', 'email'),
    ]

    for (const call of calls) await expect(call()).rejects.toThrow('AUTH_ERROR: Forbidden')
    expect(mocks.select).not.toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
