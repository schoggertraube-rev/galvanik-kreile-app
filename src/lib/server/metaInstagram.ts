const META_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
] as const

const RESPONSE_LIMIT_BYTES = 1_000_000
const REQUEST_TIMEOUT_MS = 15_000

export const META_OAUTH_STATE_COOKIE = 'kreile_meta_oauth_state'

export type MetaInstagramConfig = {
  appId: string
  appSecret: string
  redirectUri: string
  graphVersion: string
  pageId?: string
}

export type MetaInstagramPage = {
  pageId: string
  pageName: string
  pageAccessToken: string
  igUserId: string
}

export class MetaInstagramError extends Error {
  constructor(
    readonly code: string,
    readonly stage: 'configuration' | 'oauth' | 'accounts' | 'container' | 'publish'
  ) {
    super(code)
    this.name = 'MetaInstagramError'
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new MetaInstagramError('META_CONFIGURATION_MISSING', 'configuration')
  return value
}

function validRedirectUri(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  } catch {
    return false
  }
}

export function getMetaInstagramConfig(): MetaInstagramConfig {
  const appId = requiredEnv('META_APP_ID')
  const appSecret = requiredEnv('META_APP_SECRET')
  const redirectUri = requiredEnv('META_REDIRECT_URI')
  const graphVersion = requiredEnv('META_GRAPH_VERSION')
  const pageId = process.env.META_PAGE_ID?.trim() || undefined

  if (!/^\d{5,32}$/.test(appId) || appSecret.length < 16 || appSecret.length > 512) {
    throw new MetaInstagramError('META_CONFIGURATION_INVALID', 'configuration')
  }
  if (!/^v\d{1,3}\.\d{1,3}$/.test(graphVersion) || !validRedirectUri(redirectUri)) {
    throw new MetaInstagramError('META_CONFIGURATION_INVALID', 'configuration')
  }
  if (pageId && !/^\d{5,32}$/.test(pageId)) {
    throw new MetaInstagramError('META_CONFIGURATION_INVALID', 'configuration')
  }
  return { appId, appSecret, redirectUri, graphVersion, pageId }
}

export function metaInstagramIsConfigured(): boolean {
  try {
    getMetaInstagramConfig()
    return true
  } catch {
    return false
  }
}

export function buildMetaAuthorizationUrl(config: MetaInstagramConfig, state: string): string {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(state)) {
    throw new MetaInstagramError('META_OAUTH_STATE_INVALID', 'oauth')
  }
  const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`)
  url.searchParams.set('client_id', config.appId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', META_SCOPES.join(','))
  return url.toString()
}

function recordValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function requiredString(value: unknown, code: string, stage: MetaInstagramError['stage']): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 16_384) {
    throw new MetaInstagramError(code, stage)
  }
  return value
}

async function boundedJson(response: Response, stage: MetaInstagramError['stage']): Promise<Record<string, unknown>> {
  const contentLength = Number(response.headers.get('content-length') || '0')
  if (contentLength > RESPONSE_LIMIT_BYTES) throw new MetaInstagramError('META_RESPONSE_INVALID', stage)
  const text = await response.text()
  if (text.length > RESPONSE_LIMIT_BYTES) throw new MetaInstagramError('META_RESPONSE_INVALID', stage)
  try {
    return recordValue(JSON.parse(text))
  } catch {
    throw new MetaInstagramError('META_RESPONSE_INVALID', stage)
  }
}

async function requestMeta(
  url: URL,
  stage: MetaInstagramError['stage'],
  init: RequestInit,
  accessToken?: string
): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    const response = await fetch(url, { ...init, headers, signal: controller.signal, cache: 'no-store' })
    const body = await boundedJson(response, stage)
    if (!response.ok || body.error) throw new MetaInstagramError('META_REQUEST_REJECTED', stage)
    return body
  } catch (error) {
    if (error instanceof MetaInstagramError) throw error
    throw new MetaInstagramError('META_REQUEST_UNAVAILABLE', stage)
  } finally {
    clearTimeout(timeout)
  }
}

function graphUrl(config: MetaInstagramConfig, path: string): URL {
  if (!/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(path)) {
    throw new MetaInstagramError('META_PATH_INVALID', 'configuration')
  }
  return new URL(`https://graph.facebook.com/${config.graphVersion}${path}`)
}

async function postForm(
  config: MetaInstagramConfig,
  path: string,
  body: URLSearchParams,
  stage: MetaInstagramError['stage'],
  accessToken?: string
): Promise<Record<string, unknown>> {
  return requestMeta(graphUrl(config, path), stage, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }, accessToken)
}

export async function exchangeMetaAuthorizationCode(config: MetaInstagramConfig, code: string): Promise<string> {
  if (!code || code.length > 4_096) throw new MetaInstagramError('META_OAUTH_CODE_INVALID', 'oauth')
  const body = await postForm(config, '/oauth/access_token', new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code,
  }), 'oauth')
  return requiredString(body.access_token, 'META_OAUTH_TOKEN_INVALID', 'oauth')
}

export async function exchangeLongLivedMetaToken(config: MetaInstagramConfig, shortToken: string): Promise<string> {
  const body = await postForm(config, '/oauth/access_token', new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortToken,
  }), 'oauth')
  return requiredString(body.access_token, 'META_OAUTH_TOKEN_INVALID', 'oauth')
}

function parsePage(value: unknown): MetaInstagramPage | null {
  const page = recordValue(value)
  const igAccount = recordValue(page.instagram_business_account)
  const pageId = typeof page.id === 'string' ? page.id : ''
  const pageName = typeof page.name === 'string' ? page.name : ''
  const pageAccessToken = typeof page.access_token === 'string' ? page.access_token : ''
  const igUserId = typeof igAccount.id === 'string' ? igAccount.id : ''
  if (!/^\d{5,32}$/.test(pageId) || !/^\d{5,32}$/.test(igUserId) || !pageName || !pageAccessToken) return null
  return { pageId, pageName: pageName.slice(0, 200), pageAccessToken, igUserId }
}

export async function listMetaInstagramPages(
  config: MetaInstagramConfig,
  userAccessToken: string
): Promise<MetaInstagramPage[]> {
  const pages: MetaInstagramPage[] = []
  let after: string | undefined
  for (let pageNumber = 0; pageNumber < 5; pageNumber += 1) {
    const url = graphUrl(config, '/me/accounts')
    url.searchParams.set('fields', 'id,name,access_token,tasks,instagram_business_account')
    url.searchParams.set('limit', '100')
    if (after) url.searchParams.set('after', after)
    const body = await requestMeta(url, 'accounts', { method: 'GET' }, userAccessToken)
    const data = Array.isArray(body.data) ? body.data : []
    pages.push(...data.flatMap((entry) => {
      const parsed = parsePage(entry)
      return parsed ? [parsed] : []
    }))
    const paging = recordValue(body.paging)
    const cursors = recordValue(paging.cursors)
    const nextAfter = typeof cursors.after === 'string' && cursors.after.length <= 2_048 ? cursors.after : undefined
    if (!nextAfter || nextAfter === after || data.length === 0) break
    after = nextAfter
  }
  return pages
}

export function selectMetaInstagramPage(config: MetaInstagramConfig, pages: MetaInstagramPage[]): MetaInstagramPage {
  if (config.pageId) {
    const selected = pages.find((page) => page.pageId === config.pageId)
    if (!selected) throw new MetaInstagramError('META_CONFIGURED_PAGE_NOT_FOUND', 'accounts')
    return selected
  }
  if (pages.length !== 1) throw new MetaInstagramError('META_PAGE_SELECTION_REQUIRED', 'accounts')
  return pages[0]
}

export async function createMetaMediaContainer(
  config: MetaInstagramConfig,
  pageAccessToken: string,
  igUserId: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  if (!/^\d{5,32}$/.test(igUserId) || !imageUrl.startsWith('https://') || caption.length > 2_200) {
    throw new MetaInstagramError('META_PUBLISH_INPUT_INVALID', 'container')
  }
  const body = await postForm(config, `/${igUserId}/media`, new URLSearchParams({
    image_url: imageUrl,
    caption,
  }), 'container', pageAccessToken)
  return requiredString(body.id, 'META_CONTAINER_ID_INVALID', 'container')
}

async function getMetaContainerStatus(
  config: MetaInstagramConfig,
  pageAccessToken: string,
  containerId: string
): Promise<string> {
  if (!/^\d{5,64}$/.test(containerId)) throw new MetaInstagramError('META_CONTAINER_ID_INVALID', 'container')
  const url = graphUrl(config, `/${containerId}`)
  url.searchParams.set('fields', 'status_code')
  const body = await requestMeta(url, 'container', { method: 'GET' }, pageAccessToken)
  return requiredString(body.status_code, 'META_CONTAINER_STATUS_INVALID', 'container')
}

export async function waitForMetaContainer(
  config: MetaInstagramConfig,
  pageAccessToken: string,
  containerId: string,
  options: { attempts?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<void> {
  const attempts = Math.max(1, Math.min(options.attempts ?? 12, 20))
  const intervalMs = Math.max(0, Math.min(options.intervalMs ?? 1_500, 5_000))
  const sleep = options.sleep || ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const status = await getMetaContainerStatus(config, pageAccessToken, containerId)
    if (status === 'FINISHED') return
    if (status === 'ERROR' || status === 'EXPIRED' || status === 'PUBLISHED') {
      throw new MetaInstagramError('META_CONTAINER_NOT_PUBLISHABLE', 'container')
    }
    if (status !== 'IN_PROGRESS') throw new MetaInstagramError('META_CONTAINER_STATUS_INVALID', 'container')
    if (attempt + 1 < attempts) await sleep(intervalMs)
  }
  throw new MetaInstagramError('META_CONTAINER_TIMEOUT', 'container')
}

export async function publishMetaMedia(
  config: MetaInstagramConfig,
  pageAccessToken: string,
  igUserId: string,
  containerId: string
): Promise<string> {
  if (!/^\d{5,32}$/.test(igUserId) || !/^\d{5,64}$/.test(containerId)) {
    throw new MetaInstagramError('META_PUBLISH_INPUT_INVALID', 'publish')
  }
  const body = await postForm(config, `/${igUserId}/media_publish`, new URLSearchParams({
    creation_id: containerId,
  }), 'publish', pageAccessToken)
  return requiredString(body.id, 'META_MEDIA_ID_INVALID', 'publish')
}
