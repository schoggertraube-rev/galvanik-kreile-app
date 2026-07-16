import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstagramAdapter } from '@/lib/marketing/adapters/InstagramAdapter'
import type { AktionVorschlag } from '@/lib/marketing/marketingTypes'

function action(assetId?: string): AktionVorschlag {
  return {
    id: '1d019780-d63d-4d0a-92bf-0232a352c7c3',
    titel: 'Beitrag',
    kanal: 'instagram',
    kanalLabel: 'Instagram',
    score: 1,
    caption: 'Text',
    hashtags: '#galvanik',
    begruendung: 'gespeichert',
    erwarteterOutput: 'nicht gemessen',
    aufwand: '1 Min',
    kosten: '0 €',
    varianten: [],
    assetId,
  }
}

describe('Instagram browser adapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does not call a provider or API without an explicitly linked asset', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await new InstagramAdapter().publish(action())
    expect(result.success).toBe(false)
    expect(result.message).toContain('freigegebenes Bild')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends persisted identifiers plus a preview equality guard to the server endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, touchpointId: 'tp-1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const assetId = '72eb6a7f-d73a-4f56-aa4b-686148aef151'
    const result = await new InstagramAdapter().publish(action(assetId))
    expect(result).toEqual(expect.objectContaining({ success: true, touchpointId: 'tp-1' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/marketing/instagram/publish', expect.objectContaining({
      body: JSON.stringify({ actionId: action().id, assetId, expectedCaption: 'Text\n\n#galvanik' }),
    }))
  })

  it('reads connection state from the authenticated server endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ connected: true }), { status: 200 })))
    await expect(new InstagramAdapter().isConnected()).resolves.toBe(true)
  })
})
