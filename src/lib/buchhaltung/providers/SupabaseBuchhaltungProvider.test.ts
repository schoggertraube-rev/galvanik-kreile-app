import { beforeEach, describe, expect, it, vi } from 'vitest'

const actionMocks = vi.hoisted(() => ({
  listBelegeAction: vi.fn(),
  getBelegAction: vi.fn(),
  createBelegAction: vi.fn(),
  freigebenBelegAction: vi.fn(),
  stornoBelegAction: vi.fn(),
  generateDatevExportAction: vi.fn(),
  generateLexwareExportAction: vi.fn(),
  getCockpitMetricsAction: vi.fn(),
  getSteuerprofilAction: vi.fn(),
  listKostenpostenAction: vi.fn(),
  listOffenePostenAction: vi.fn(),
  listRechnungenAction: vi.fn(),
}))

const analysisMocks = vi.hoisted(() => ({
  getBwaAnalysisAction: vi.fn(),
  getKraftstoffAnalysisAction: vi.fn(),
  getSparzaehlerAnalysisAction: vi.fn(),
}))

vi.mock('@/app/buchhaltung/actions', () => actionMocks)
vi.mock('@/app/buchhaltung/analysis.actions', () => analysisMocks)

import { SupabaseBuchhaltungProvider } from './SupabaseBuchhaltungProvider'

describe('SupabaseBuchhaltungProvider truth contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionMocks.getCockpitMetricsAction.mockResolvedValue({
      bwa: { einnahmen: 1_000 },
      kategorien: [{ kategorieId: 'material', kategorieName: 'Material', summe: 250, anzahl: 2 }],
      ustva: { zeitraumVon: '2026-07-01', zeitraumBis: '2026-07-31', umsatz19: 1000, ust19: 190, umsatz7: 0, ust7: 0, umsatz0: 0, vorsteuer: 50, zahllast: 140, status: 'berechnet' },
    })
    analysisMocks.getKraftstoffAnalysisAction.mockResolvedValue({
      gesamtKosten: 150,
      gesamtLiter: 75,
      avgPreis: 2,
      tankungenCount: 2,
      nachSorte: [
        { sorte: 'Diesel', liter: 50, kosten: 100 },
        { sorte: 'mystery fuel', liter: 25, kosten: 50 },
      ],
      nachOrt: [{ ort: 'Frankfurt', anzahl: 2, kosten: 150 }],
      nachMonat: [{ monat: '2026-07', liter: 75, kosten: 150 }],
    })
    analysisMocks.getBwaAnalysisAction.mockResolvedValue({
      einnahmen: 1_000,
      material: 200,
      fremdleistungen: 100,
      betrieb: 50,
      variableKosten: 25,
      personal: 150,
      fixkosten: 75,
      deckungsbeitrag: 625,
      betriebsergebnis: 400,
    })
    actionMocks.listKostenpostenAction.mockImplementation(async (filter?: { art?: string }) => [{
      id: `${filter?.art}-1`,
      bezeichnung: filter?.art === 'fix' ? 'Miete' : 'Verpackung',
      art: filter?.art,
      betrag: 100,
      intervall: 'monatlich',
      giltAb: '2026-01-01',
    }])
    actionMocks.listOffenePostenAction.mockResolvedValue([{ id: 'invoice-open' }])
    actionMocks.listRechnungenAction.mockResolvedValue([{ id: 'invoice-all' }])
    actionMocks.getSteuerprofilAction.mockResolvedValue({ id: 'profile-live', bezeichnung: 'Live' })
    actionMocks.generateDatevExportAction.mockResolvedValue('DATEV-HEADER\nCOLUMNS\nBOOKING')
    actionMocks.generateLexwareExportAction.mockResolvedValue('LEXWARE-HEADER\nBOOKING')
    analysisMocks.getSparzaehlerAnalysisAction.mockResolvedValue({
      ersparnisBetrag: 48,
      anzahlAutoBelege: 6,
      minutenProBeleg: 4,
      stundensatz: 120,
      prozentAutomatisch: 75,
    })
  })

  it('returns connected bookkeeping, fuel, BWA, cost, invoice and tax-profile data', async () => {
    const provider = new SupabaseBuchhaltungProvider()
    const period = { von: '2026-07-01', bis: '2026-07-31' }

    await expect(provider.getAusgabenNachKategorie(period)).resolves.toEqual([
      expect.objectContaining({ kategorieName: 'Material', summe: 250, anteilAmUmsatz: 25 }),
    ])
    await expect(provider.getKraftstoffAuswertung(period)).resolves.toEqual(expect.objectContaining({
      gesamtkosten: 150,
      nachSorte: expect.arrayContaining([
        { sorte: 'diesel', liter: 50, kosten: 100 },
        { sorte: 'unbekannt', liter: 25, kosten: 50 },
      ]),
    }))
    await expect(provider.getBwa(period)).resolves.toEqual(expect.objectContaining({
      umsatzerloese: 1_000,
      deckungsbeitrag: 625,
      betriebsergebnis: 400,
    }))
    await expect(provider.getFixkosten()).resolves.toEqual([
      expect.objectContaining({ name: 'Miete', category: 'fix', status: 'aktiv' }),
    ])
    await expect(provider.getVariableKosten()).resolves.toEqual([
      expect.objectContaining({ name: 'Verpackung', category: 'variabel', status: 'aktiv' }),
    ])
    await expect(provider.listOffenePosten()).resolves.toEqual([{ id: 'invoice-open' }])
    await expect(provider.listRechnungen()).resolves.toEqual([{ id: 'invoice-all' }])
    await expect(provider.getSteuerprofil()).resolves.toEqual({ id: 'profile-live', bezeichnung: 'Live' })
    await expect(provider.berechneUstva(period)).resolves.toEqual(expect.objectContaining({ zahllast: 140 }))
  })

  it('propagates data-source failures instead of returning plausible zero values', async () => {
    actionMocks.getCockpitMetricsAction.mockRejectedValueOnce(new Error('database unavailable'))
    const provider = new SupabaseBuchhaltungProvider()
    await expect(provider.berechneUstva({ von: '2026-07-01', bis: '2026-07-31' }))
      .rejects.toThrow('database unavailable')
  })

  it('creates a real ZIP package and reports exactly what it contains', async () => {
    const provider = new SupabaseBuchhaltungProvider()
    const result = await provider.exportSteuerberaterPaket({ von: '2026-07-01', bis: '2026-07-31' })
    const bytes = new Uint8Array(await (result.inhalt as Blob).arrayBuffer())
    const visibleText = new TextDecoder().decode(bytes)

    expect(result.typ).toBe('steuerberater_zip')
    expect(result.mimeType).toBe('application/zip')
    expect(result.anzahlBuchungen).toBe(1)
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(0x04034b50)
    expect(visibleText).toContain('manifest.json')
    expect(visibleText).toContain('"receiptsIncluded": false')
  })

  it('uses configured savings assumptions returned by the data action', async () => {
    const provider = new SupabaseBuchhaltungProvider()
    await expect(provider.getErsparnis(2026)).resolves.toEqual({
      jahr: 2026,
      betrag: 48,
      anzahlAutoBelege: 6,
      minutenProBeleg: 4,
      beraterStundensatz: 120,
      prozentAutomatisch: 75,
    })
  })
})
