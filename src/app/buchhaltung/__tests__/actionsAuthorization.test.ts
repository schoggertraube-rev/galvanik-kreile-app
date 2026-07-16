import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireFinanceRead: vi.fn(),
  requireFinanceWrite: vi.fn(),
  assertFinanceDateRange: vi.fn(),
  createServiceClient: vi.fn(),
  dbSelect: vi.fn(),
  dbTransaction: vi.fn(),
  ocrPost: vi.fn(),
}))

vi.mock('@/lib/server/financeAuthorization', () => ({
  requireFinanceRead: mocks.requireFinanceRead,
  requireFinanceWrite: mocks.requireFinanceWrite,
  assertFinanceDateRange: mocks.assertFinanceDateRange,
}))
vi.mock('@/lib/server/supabaseService', () => ({
  createSupabaseServiceClient: mocks.createServiceClient,
}))
vi.mock('@/db', () => ({ db: { select: mocks.dbSelect, transaction: mocks.dbTransaction } }))
vi.mock('@/app/api/ocr-process/route', () => ({ POST: mocks.ocrPost }))

import * as actions from '@/app/buchhaltung/actions'

describe('bookkeeping Server Action authorization boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireFinanceRead.mockRejectedValue(new Error('AUTH_ERROR: Forbidden'))
    mocks.requireFinanceWrite.mockRejectedValue(new Error('AUTH_ERROR: Forbidden'))
  })

  it('rejects every public action before service credentials, form parsing or database work', async () => {
    const calls: Array<() => Promise<unknown>> = [
      () => actions.listBelegeAction(),
      () => actions.getBelegAction('00000000-0000-0000-0000-000000000000'),
      () => actions.createBelegAction(new FormData()),
      () => actions.freigebenBelegAction('00000000-0000-0000-0000-000000000000'),
      () => actions.stornoBelegAction('00000000-0000-0000-0000-000000000000', 'Korrektur'),
      () => actions.assignBelegeBatchAction([], {}),
      () => actions.getKraftstoffTankungenAction(),
      () => actions.exportBelegeAction('CSV'),
      () => actions.listRechnungenAction(),
      () => actions.listOffenePostenAction(),
      () => actions.createRechnungAction(new FormData(), []),
      () => actions.getRechnungAction('00000000-0000-0000-0000-000000000000'),
      () => actions.listKostenpostenAction(),
      () => actions.createKostenpostenAction(new FormData()),
      () => actions.getKostenpostenAction('00000000-0000-0000-0000-000000000000'),
      () => actions.getSteuerprofilAction(),
      () => actions.getCockpitMetricsAction('not-a-date', 'not-a-date'),
      () => actions.generateDatevExportAction('not-a-date', 'not-a-date'),
      () => actions.generateLexwareExportAction('not-a-date', 'not-a-date'),
      () => actions.getL7Daten({}),
    ]

    for (const call of calls) {
      await expect(call()).rejects.toThrow('AUTH_ERROR: Forbidden')
    }
    expect(mocks.requireFinanceRead.mock.calls.length + mocks.requireFinanceWrite.mock.calls.length)
      .toBe(calls.length)
    expect(mocks.assertFinanceDateRange).not.toHaveBeenCalled()
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
    expect(mocks.dbSelect).not.toHaveBeenCalled()
  })

  it('routes receipt creation through the validated OCR pipeline instead of inserting zero placeholders', async () => {
    mocks.requireFinanceRead.mockResolvedValue({
      userId: 'finance-user',
      tenantId: 'galvanik-kreile',
      permissions: ['perm_view_prices'],
      active: true,
    })
    mocks.requireFinanceWrite.mockResolvedValue({
      userId: 'finance-user',
      tenantId: 'galvanik-kreile',
      role: 'buero',
      permissions: ['perm_view_prices'],
      active: true,
    })
    mocks.ocrPost.mockResolvedValue(Response.json({ error: 'OCR pipeline unavailable' }, { status: 503 }))
    const formData = new FormData()
    formData.append('file', new File(['%PDF'], 'receipt.pdf', { type: 'application/pdf' }))

    await expect(actions.createBelegAction(formData)).rejects.toThrow('OCR pipeline unavailable')
    expect(mocks.ocrPost).toHaveBeenCalledTimes(1)
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
  })

  it('creates invoice header and positions through one database transaction', async () => {
    mocks.requireFinanceRead.mockResolvedValue({
      userId: 'finance-user',
      tenantId: 'galvanik-kreile',
      permissions: ['perm_view_prices'],
      active: true,
    })
    mocks.requireFinanceWrite.mockResolvedValue({
      userId: 'finance-user',
      tenantId: 'galvanik-kreile',
      role: 'buero',
      permissions: ['perm_view_prices'],
      active: true,
    })
    mocks.dbTransaction.mockResolvedValue({
      id: 'invoice-1',
      nummer: 'RE-2026-1',
      kundeId: 'customer-1',
      datum: '2026-07-01',
      faelligAm: '2026-07-15',
      brutto: '119.00',
      netto: '100.00',
      ustSatz: '19.00',
      ustBetrag: '19.00',
      status: 'offen',
      mahnstufe: 0,
      bemerkung: null,
      leadId: null,
    })
    const formData = new FormData()
    formData.set('nummer', 'RE-2026-1')
    formData.set('kundeId', 'customer-1')
    formData.set('datum', '2026-07-01')
    formData.set('faelligAm', '2026-07-15')
    formData.set('ustSatz', '19')

    await expect(actions.createRechnungAction(formData, [
      { beschreibung: 'Galvanik', menge: 1, einzelpreisNetto: 100 },
    ])).resolves.toEqual(expect.objectContaining({ id: 'invoice-1', brutto: 119 }))
    expect(mocks.dbTransaction).toHaveBeenCalledTimes(1)
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
  })
})
