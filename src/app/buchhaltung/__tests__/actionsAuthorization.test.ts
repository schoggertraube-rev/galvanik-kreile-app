import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireFinanceRead: vi.fn(),
  requireFinanceWrite: vi.fn(),
  assertFinanceDateRange: vi.fn(),
  createServiceClient: vi.fn(),
  dbSelect: vi.fn(),
  dbTransaction: vi.fn(),
  ocrPost: vi.fn(),
  readInvoiceCreateCapability: vi.fn(),
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
vi.mock('@/lib/server/invoiceCreateCapability', () => ({
  readInvoiceCreateCapability: mocks.readInvoiceCreateCapability,
}))

import * as actions from '@/app/buchhaltung/actions'

describe('bookkeeping Server Action authorization boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireFinanceRead.mockRejectedValue(new Error('AUTH_ERROR: Forbidden'))
    mocks.requireFinanceWrite.mockRejectedValue(new Error('AUTH_ERROR: Forbidden'))
    mocks.readInvoiceCreateCapability.mockResolvedValue({ available: false, reason: 'rollout required' })
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
      () => actions.saveKraftstoffDetailAction('00000000-0000-4000-8000-000000000001', {}),
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
    const requestId = '11111111-1111-4111-8111-111111111111'
    mocks.readInvoiceCreateCapability.mockResolvedValue({ available: true, reason: null })
    mocks.dbTransaction.mockResolvedValue({
      invoice: {
        id: requestId,
        tenantId: 'galvanik-kreile',
        nummer: 'RE-2026-1',
        kundeId: 'customer-1',
        orderId: null,
        datum: '2026-07-01',
        faelligAm: '2026-07-15',
        brutto: '119.00',
        netto: '100.00',
        ustSatz: '19.00',
        ustBetrag: '19.00',
        bezahltAm: null,
        bezahltMethode: null,
        bezahltBetragEur: null,
        bezahltPaymentId: null,
        status: 'offen',
        mahnstufe: 0,
        erechnungXml: null,
        leadId: null,
        bemerkung: null,
        periodeId: null,
        erloesKontoId: null,
        forderungKontoId: null,
        agingStatus: null,
        isDemo: false,
        erstelltAm: new Date('2026-07-01T00:00:00Z'),
      },
      storedPositions: [{ beschreibung: 'Galvanik', menge: 1, einzelpreisNetto: 100 }],
      replayed: false,
    })
    const formData = new FormData()
    formData.set('clientRequestId', requestId)
    formData.set('nummer', 'RE-2026-1')
    formData.set('kundeId', 'customer-1')
    formData.set('datum', '2026-07-01')
    formData.set('faelligAm', '2026-07-15')
    formData.set('ustSatz', '19')

    await expect(actions.createRechnungAction(formData, [
      { beschreibung: 'Galvanik', menge: 1, einzelpreisNetto: 100 },
    ])).resolves.toEqual(expect.objectContaining({ id: requestId, brutto: 119, replayed: false }))
    expect(mocks.dbTransaction).toHaveBeenCalledTimes(1)
    expect(mocks.readInvoiceCreateCapability).toHaveBeenCalledTimes(1)
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
  })

  it('stores reviewed fuel detail and audit atomically before finalization', async () => {
    const actor = {
      userId: '00000000-0000-4000-8000-000000000099',
      tenantId: 'galvanik-kreile',
      role: 'buero',
      permissions: ['perm_view_prices'],
      active: true,
    }
    mocks.requireFinanceWrite.mockResolvedValue(actor)
    const receiptId = '00000000-0000-4000-8000-000000000001'
    const detailId = '00000000-0000-4000-8000-000000000002'
    const selectResults = [
      [{ id: receiptId, belegart: 'tankbeleg', status: 'erfasst' }],
      [{ id: detailId, belegId: receiptId, sorte: 'diesel', liter: '40.00', preisProLiter: null, tankstelle: null, ort: null }],
    ]
    const updateSet = vi.fn()
    const tx = {
      select: vi.fn(() => {
        const result = selectResults.shift() ?? []
        const query = {
          from: () => query,
          where: () => query,
          limit: () => query,
          for: async () => result,
        }
        return query
      }),
      update: vi.fn(() => ({
        set: (value: unknown) => {
          updateSet(value)
          return {
            where: () => ({
              returning: async () => [{
                id: detailId,
                belegId: receiptId,
                sorte: 'diesel',
                liter: '42.50',
                preisProLiter: '1.729',
                tankstelle: 'Mainova',
                ort: 'Frankfurt',
              }],
            }),
          }
        },
      })),
      insert: vi.fn(() => ({
        values: () => ({ returning: async () => [{ id: '00000000-0000-4000-8000-000000000003' }] }),
      })),
    }
    mocks.dbTransaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx))

    await expect(actions.saveKraftstoffDetailAction(receiptId, {
      sorte: 'diesel',
      liter: 42.5,
      preisProLiter: 1.729,
      tankstelle: 'Mainova',
      ort: 'Frankfurt',
    })).resolves.toMatchObject({
      id: detailId,
      belegId: receiptId,
      sorte: 'diesel',
      liter: 42.5,
      preisProLiter: 1.729,
    })
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ liter: '42.50', preisProLiter: '1.729' }))
    expect(tx.insert).toHaveBeenCalledTimes(1)
  })

  it('keeps finalized fuel evidence immutable', async () => {
    mocks.requireFinanceWrite.mockResolvedValue({
      userId: '00000000-0000-4000-8000-000000000099',
      tenantId: 'galvanik-kreile',
      role: 'buero',
      permissions: ['perm_view_prices'],
      active: true,
    })
    const receiptId = '00000000-0000-4000-8000-000000000001'
    const tx = {
      select: vi.fn(() => {
        const query = {
          from: () => query,
          where: () => query,
          limit: () => query,
          for: async () => [{ id: receiptId, belegart: 'tankbeleg', status: 'festgeschrieben' }],
        }
        return query
      }),
    }
    mocks.dbTransaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx))

    await expect(actions.saveKraftstoffDetailAction(receiptId, {
      sorte: 'diesel',
      liter: 42.5,
    })).rejects.toThrow('FINANCE_FUEL_RECEIPT_IMMUTABLE')
  })
})
