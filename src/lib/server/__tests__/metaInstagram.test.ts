import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildMetaAuthorizationUrl,
  createMetaMediaContainer,
  exchangeLongLivedMetaToken,
  exchangeMetaAuthorizationCode,
  getMetaInstagramConfig,
  listMetaInstagramPages,
  publishMetaMedia,
  selectMetaInstagramPage,
  waitForMetaContainer,
} from '@/lib/server/metaInstagram'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Meta Instagram server connector', () => {
  beforeEach(() => {
    vi.stubEnv('META_APP_ID', '123456789012345')
    vi.stubEnv('META_APP_SECRET', 'a-secure-app-secret-value')
    vi.stubEnv('META_REDIRECT_URI', 'https://app.example.test/api/marketing/instagram/callback')
    vi.stubEnv('META_GRAPH_VERSION', 'v30.0')
    vi.stubEnv('META_PAGE_ID', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses an authorization-code flow with a caller-bound state', () => {
    const url = new URL(buildMetaAuthorizationUrl(getMetaInstagramConfig(), 'x'.repeat(43)))
    expect(url.origin).toBe('https://www.facebook.com')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe('x'.repeat(43))
    expect(url.searchParams.get('scope')).toContain('instagram_content_publish')
    expect(url.searchParams.has('access_token')).toBe(false)
  })

  it('keeps app secrets and access tokens out of request URLs', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'short-user-token' }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'long-user-token' }))
      .mockResolvedValueOnce(jsonResponse({
        data: [{
          id: '123456789',
          name: 'Kreile',
          access_token: 'page-access-token',
          instagram_business_account: { id: '987654321' },
        }],
      }))
    vi.stubGlobal('fetch', mockFetch)
    const config = getMetaInstagramConfig()

    const shortToken = await exchangeMetaAuthorizationCode(config, 'authorization-code')
    const longToken = await exchangeLongLivedMetaToken(config, shortToken)
    const pages = await listMetaInstagramPages(config, longToken)

    expect(pages).toEqual([expect.objectContaining({ pageId: '123456789', igUserId: '987654321' })])
    for (const call of mockFetch.mock.calls) {
      const url = String(call[0])
      expect(url).not.toContain('a-secure-app-secret-value')
      expect(url).not.toContain('short-user-token')
      expect(url).not.toContain('long-user-token')
      expect(url).not.toContain('page-access-token')
    }
    expect(new Headers(mockFetch.mock.calls[2][1].headers).get('Authorization')).toBe('Bearer long-user-token')
  })

  it('publishes only after the provider reports a finished container', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: '111111111' }))
      .mockResolvedValueOnce(jsonResponse({ status_code: 'IN_PROGRESS' }))
      .mockResolvedValueOnce(jsonResponse({ status_code: 'FINISHED' }))
      .mockResolvedValueOnce(jsonResponse({ id: '222222222' }))
    vi.stubGlobal('fetch', mockFetch)
    const config = getMetaInstagramConfig()

    const containerId = await createMetaMediaContainer(
      config,
      'page-access-token',
      '987654321',
      'https://storage.example.test/signed-image',
      'Freigegebener Beitrag'
    )
    await waitForMetaContainer(config, 'page-access-token', containerId, {
      attempts: 3,
      intervalMs: 0,
      sleep: async () => undefined,
    })
    await expect(publishMetaMedia(config, 'page-access-token', '987654321', containerId)).resolves.toBe('222222222')

    expect(String(mockFetch.mock.calls[0][0])).not.toContain('page-access-token')
    expect(String(mockFetch.mock.calls[3][0])).not.toContain('page-access-token')
    expect(String(mockFetch.mock.calls[3][1].body)).toContain('creation_id=111111111')
  })

  it('requires an explicit page choice when multiple Instagram pages are eligible', () => {
    const config = getMetaInstagramConfig()
    expect(() => selectMetaInstagramPage(config, [
      { pageId: '11111', pageName: 'One', pageAccessToken: 'one', igUserId: '22222' },
      { pageId: '33333', pageName: 'Two', pageAccessToken: 'two', igUserId: '44444' },
    ])).toThrow('META_PAGE_SELECTION_REQUIRED')
  })
})
