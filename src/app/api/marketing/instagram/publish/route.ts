import { NextResponse } from 'next/server'
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { aktion, kanal, marketingAsset, marketingPublishJob, touchpoint } from '@/db/schema_marketing'
import { requireMarketingWrite } from '@/lib/server/marketingAuthorization'
import { decryptMarketingToken } from '@/lib/server/marketingTokenVault'
import { createSupabaseServiceClient } from '@/lib/server/supabaseService'
import {
  createMetaMediaContainer,
  getMetaInstagramConfig,
  MetaInstagramError,
  publishMetaMedia,
  waitForMetaContainer,
} from '@/lib/server/metaInstagram'

export const runtime = 'nodejs'
export const maxDuration = 60

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STALE_JOB_BEFORE_MS = 10 * 60 * 1_000

type PublishInput = { actionId: string; assetId: string; expectedCaption: string }
type PublishJob = typeof marketingPublishJob.$inferSelect

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseInput(value: unknown): PublishInput | null {
  const body = objectValue(value)
  if (Object.keys(body).sort().join(',') !== 'actionId,assetId,expectedCaption') return null
  if (!UUID_PATTERN.test(textValue(body.actionId)) || !UUID_PATTERN.test(textValue(body.assetId))) return null
  const expectedCaption = textValue(body.expectedCaption)
  if (!expectedCaption || expectedCaption.length > 2_200 || expectedCaption.includes('\0')) return null
  return { actionId: textValue(body.actionId), assetId: textValue(body.assetId), expectedCaption }
}

function buildCaption(title: string, value: unknown): string | null {
  const content = objectValue(value)
  const caption = textValue(content.caption) || textValue(content.text) || title
  const hashtags = Array.isArray(content.hashtags)
    ? content.hashtags.filter((entry): entry is string => typeof entry === 'string').join(' ')
    : textValue(content.hashtags)
  const combined = [caption.trim(), hashtags.trim()].filter(Boolean).join('\n\n')
  return combined.length > 0 && combined.length <= 2_200 && !combined.includes('\0') ? combined : null
}

function validStorageLocation(
  tenantId: string,
  orderId: string | null,
  bucket: string | null,
  path: string
): bucket is 'item-photos' {
  if (bucket !== 'item-photos' || !orderId || path.length < 20 || path.length > 1_024) return false
  return path.startsWith(`${tenantId}/${orderId}/`)
    && !path.startsWith('/')
    && !path.includes('\\')
    && !path.split('/').includes('..')
    && !/[\u0000-\u001f\u007f]/.test(path)
}

function jsonError(code: string, status: number) {
  return NextResponse.json({ ok: false, code }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function loadJob(tenantId: string, actionId: string): Promise<PublishJob | undefined> {
  return (await db.select().from(marketingPublishJob).where(and(
    eq(marketingPublishJob.tenantId, tenantId),
    eq(marketingPublishJob.aktionId, actionId)
  )).limit(1))[0]
}

async function loadReplayEvidence(tenantId: string, job: PublishJob): Promise<string | null> {
  if (job.status !== 'succeeded' || !job.externalMediaId) return null
  const [evidence] = await db.select({ id: touchpoint.id }).from(touchpoint).where(and(
    eq(touchpoint.tenantId, tenantId),
    eq(touchpoint.aktionId, job.aktionId),
    eq(touchpoint.kanalId, job.kanalId),
    eq(touchpoint.externeRef, job.externalMediaId)
  )).limit(1)
  return evidence?.id ?? null
}

async function reservePublishJob(tenantId: string, input: PublishInput, channelId: string): Promise<
  | { kind: 'claimed'; job: PublishJob }
  | { kind: 'succeeded'; job: PublishJob }
  | { kind: 'in_progress' }
  | { kind: 'uncertain' }
> {
  await db.insert(marketingPublishJob).values({
    tenantId,
    aktionId: input.actionId,
    assetId: input.assetId,
    kanalId: channelId,
    status: 'reserved',
  }).onConflictDoNothing({ target: [marketingPublishJob.tenantId, marketingPublishJob.aktionId] })

  let job = await loadJob(tenantId, input.actionId)
  if (!job || job.assetId !== input.assetId || job.kanalId !== channelId) return { kind: 'uncertain' }
  if (job.status === 'succeeded') return { kind: 'succeeded', job }
  if (job.status === 'uncertain') return { kind: 'uncertain' }
  if (job.externalContainerId) {
    const marked = await db.update(marketingPublishJob).set({
      status: 'uncertain',
      errorCode: 'EXTERNAL_CONTAINER_ALREADY_EXISTS',
      aktualisiertAm: new Date(),
    }).where(and(
      eq(marketingPublishJob.tenantId, tenantId),
      eq(marketingPublishJob.id, job.id),
      eq(marketingPublishJob.status, job.status),
      eq(marketingPublishJob.externalContainerId, job.externalContainerId)
    )).returning({ id: marketingPublishJob.id })
    if (marked.length !== 1) {
      const current = await loadJob(tenantId, input.actionId)
      if (current?.status === 'succeeded' && current.assetId === input.assetId && current.kanalId === channelId) {
        return { kind: 'succeeded', job: current }
      }
    }
    return { kind: 'uncertain' }
  }
  if (job.status === 'publishing') {
    if (job.claimedAt && job.claimedAt.getTime() < Date.now() - STALE_JOB_BEFORE_MS) {
      const marked = await db.update(marketingPublishJob).set({
        status: 'uncertain',
        errorCode: 'STALE_PUBLISHING_JOB',
        aktualisiertAm: new Date(),
      }).where(and(
        eq(marketingPublishJob.tenantId, tenantId),
        eq(marketingPublishJob.id, job.id),
        eq(marketingPublishJob.status, 'publishing'),
        lt(marketingPublishJob.claimedAt, new Date(Date.now() - STALE_JOB_BEFORE_MS))
      )).returning({ id: marketingPublishJob.id })
      if (marked.length !== 1) {
        const current = await loadJob(tenantId, input.actionId)
        if (current?.status === 'succeeded' && current.assetId === input.assetId && current.kanalId === channelId) {
          return { kind: 'succeeded', job: current }
        }
        return current?.status === 'publishing' ? { kind: 'in_progress' } : { kind: 'uncertain' }
      }
      return { kind: 'uncertain' }
    }
    return { kind: 'in_progress' }
  }
  if (!['reserved', 'failed'].includes(job.status)) return { kind: 'uncertain' }

  const [claimed] = await db.update(marketingPublishJob).set({
    status: 'publishing',
    claimedAt: new Date(),
    completedAt: null,
    errorCode: null,
    attemptCount: sql`${marketingPublishJob.attemptCount} + 1`,
    aktualisiertAm: new Date(),
  }).where(and(
    eq(marketingPublishJob.tenantId, tenantId),
    eq(marketingPublishJob.id, job.id),
    inArray(marketingPublishJob.status, ['reserved', 'failed']),
    isNull(marketingPublishJob.externalContainerId)
  )).returning()
  if (!claimed) return { kind: 'in_progress' }
  job = claimed
  return { kind: 'claimed', job }
}

async function settleFailedJob(
  tenantId: string,
  jobId: string,
  uncertain: boolean,
  error: unknown,
  mediaId?: string
): Promise<void> {
  const errorCode = error instanceof MetaInstagramError
    ? error.code
    : error instanceof Error && /^[A-Z0-9_]{3,120}$/.test(error.message)
      ? error.message
      : 'INSTAGRAM_PUBLISH_INTERNAL_ERROR'
  try {
    await db.update(marketingPublishJob).set({
      status: uncertain ? 'uncertain' : 'failed',
      externalMediaId: mediaId || null,
      completedAt: new Date(),
      errorCode: errorCode.slice(0, 120),
      aktualisiertAm: new Date(),
    }).where(and(
      eq(marketingPublishJob.tenantId, tenantId),
      eq(marketingPublishJob.id, jobId),
      eq(marketingPublishJob.status, 'publishing')
    )).returning({ id: marketingPublishJob.id })
  } catch {
    // The caller still fails closed. A missing settlement must never trigger a blind retry.
  }
}

export async function POST(request: Request) {
  let tenantId: string
  try {
    const actor = await requireMarketingWrite()
    tenantId = actor.tenantId
  } catch {
    return jsonError('FORBIDDEN', 403)
  }

  if (Number(request.headers.get('content-length') || '0') > 2_048) return jsonError('INVALID_REQUEST', 400)
  let input: PublishInput | null = null
  try {
    input = parseInput(await request.json())
  } catch {
    input = null
  }
  if (!input) return jsonError('INVALID_REQUEST', 400)

  const [record] = await db.select({
    actionId: aktion.id,
    title: aktion.titel,
    type: aktion.typ,
    content: aktion.inhalt,
    actionStatus: aktion.status,
    channelId: kanal.id,
    channelType: kanal.typ,
    channelConnected: kanal.verbunden,
    channelStatus: kanal.status,
    channelConfig: kanal.config,
    accessTokenEncrypted: kanal.accessTokenEncrypted,
  }).from(aktion)
    .leftJoin(kanal, and(
      eq(aktion.kanalId, kanal.id),
      eq(kanal.tenantId, tenantId),
      eq(kanal.truthStatus, 'verified')
    ))
    .where(and(
      eq(aktion.tenantId, tenantId),
      eq(aktion.truthStatus, 'verified'),
      eq(aktion.isDemo, false),
      eq(aktion.id, input.actionId)
    ))
    .limit(1)
  if (!record || !record.channelId) return jsonError('ACTION_NOT_FOUND', 404)
  const channelId = record.channelId
  if (record.type !== 'post') return jsonError('ACTION_NOT_APPROVED', 409)

  const content = objectValue(record.content)
  if (textValue(content.assetId) !== input.assetId) return jsonError('ASSET_NOT_APPROVED', 409)
  const caption = buildCaption(record.title, record.content)
  if (!caption) return jsonError('ACTION_CONTENT_INVALID', 409)
  if (caption !== input.expectedCaption) return jsonError('ACTION_CONTENT_NOT_APPROVED', 409)

  const priorJob = await loadJob(tenantId, input.actionId)
  if (priorJob?.status === 'succeeded') {
    if (priorJob.assetId !== input.assetId || priorJob.kanalId !== channelId) {
      return jsonError('PUBLISH_EVIDENCE_MISSING', 409)
    }
    const evidenceId = await loadReplayEvidence(tenantId, priorJob)
    if (!evidenceId) return jsonError('PUBLISH_EVIDENCE_MISSING', 409)
    return NextResponse.json({
      ok: true,
      message: 'Instagram-Beitrag wurde bereits veröffentlicht.',
      touchpointId: evidenceId,
      replay: true,
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (record.actionStatus !== 'freigegeben') return jsonError('ACTION_NOT_APPROVED', 409)

  const [asset] = await db.select().from(marketingAsset).where(and(
    eq(marketingAsset.tenantId, tenantId),
    eq(marketingAsset.id, input.assetId)
  )).limit(1)
  if (!asset
    || asset.freigabeMarketing !== true
    || !asset.sourceItemPhotoJobId
    || !(asset.sourceItemPhotoUploadedAt instanceof Date)
    || Number.isNaN(asset.sourceItemPhotoUploadedAt.getTime())
    || !validStorageLocation(
    tenantId,
    asset.auftragId,
    asset.storageBucket,
    asset.storagePfad
  )) {
    return jsonError('ASSET_NOT_APPROVED', 409)
  }
  if (record.channelType !== 'instagram' || record.channelConnected !== true || record.channelStatus !== 'verbunden' || !record.accessTokenEncrypted) {
    return jsonError('CHANNEL_NOT_CONNECTED', 409)
  }

  const channelConfig = objectValue(record.channelConfig)
  const igUserId = textValue(channelConfig.igUserId)
  if (!/^\d{5,32}$/.test(igUserId)) return jsonError('CHANNEL_NOT_CONNECTED', 409)

  let metaConfig: ReturnType<typeof getMetaInstagramConfig>
  let pageAccessToken: string
  try {
    metaConfig = getMetaInstagramConfig()
    pageAccessToken = decryptMarketingToken(record.accessTokenEncrypted, {
      tenantId,
      channelId,
    })
  } catch {
    return jsonError('CONFIGURATION_MISSING', 503)
  }

  const reservation = await reservePublishJob(tenantId, input, channelId)
  if (reservation.kind === 'succeeded') {
    const evidenceId = await loadReplayEvidence(tenantId, reservation.job)
    if (!evidenceId) return jsonError('PUBLISH_EVIDENCE_MISSING', 409)
    return NextResponse.json({
      ok: true,
      message: 'Instagram-Beitrag wurde bereits veröffentlicht.',
      touchpointId: evidenceId,
      replay: true,
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (reservation.kind === 'in_progress') return jsonError('PUBLISH_IN_PROGRESS', 409)
  if (reservation.kind === 'uncertain') return jsonError('PUBLISH_UNCERTAIN', 409)

  let containerId: string | undefined
  let mediaId: string | undefined
  try {
    const signed = await createSupabaseServiceClient().storage
      .from(asset.storageBucket)
      .createSignedUrl(asset.storagePfad, 15 * 60)
    if (signed.error || !signed.data?.signedUrl) throw new Error('MARKETING_ASSET_SIGNING_FAILED')

    containerId = await createMetaMediaContainer(metaConfig, pageAccessToken, igUserId, signed.data.signedUrl, caption)
    const containerRecorded = await db.update(marketingPublishJob).set({
      externalContainerId: containerId,
      aktualisiertAm: new Date(),
    }).where(and(
      eq(marketingPublishJob.tenantId, tenantId),
      eq(marketingPublishJob.id, reservation.job.id),
      eq(marketingPublishJob.status, 'publishing')
    )).returning({ id: marketingPublishJob.id })
    if (containerRecorded.length !== 1) throw new Error('PUBLISH_JOB_CONTAINER_RECORD_FAILED')

    await waitForMetaContainer(metaConfig, pageAccessToken, containerId)
    mediaId = await publishMetaMedia(metaConfig, pageAccessToken, igUserId, containerId)
    const publishedMediaId = mediaId

    const completed = await db.transaction(async (tx) => {
      const now = new Date()
      const existing = await tx.select({
        id: touchpoint.id,
        kanalId: touchpoint.kanalId,
        externeRef: touchpoint.externeRef,
      }).from(touchpoint)
        .where(and(
          eq(touchpoint.tenantId, tenantId),
          eq(touchpoint.aktionId, input.actionId)
        )).limit(1)
      let touchpointId: string
      if (existing[0]) {
        if (existing[0].kanalId !== channelId
          || (existing[0].externeRef !== null && existing[0].externeRef !== publishedMediaId)) {
          throw new Error('PUBLISH_TOUCHPOINT_EVIDENCE_CONFLICT')
        }
        const [updatedTouchpoint] = await tx.update(touchpoint).set({
          kanalId: channelId,
          externeRef: publishedMediaId,
          ausgefuehrtAm: now,
        }).where(and(
          eq(touchpoint.tenantId, tenantId),
          eq(touchpoint.id, existing[0].id),
          eq(touchpoint.aktionId, input.actionId),
          eq(touchpoint.kanalId, channelId),
          or(isNull(touchpoint.externeRef), eq(touchpoint.externeRef, publishedMediaId))
        )).returning({ id: touchpoint.id })
        if (!updatedTouchpoint) throw new Error('PUBLISH_TOUCHPOINT_RECEIPT_MISSING')
        touchpointId = updatedTouchpoint.id
      } else {
        const [created] = await tx.insert(touchpoint).values({
          tenantId,
          aktionId: input.actionId,
          kanalId: channelId,
          externeRef: publishedMediaId,
          utmCampaign: record.title.substring(0, 80).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
          utmSource: 'instagram',
          utmMedium: 'organic-social',
          ausgefuehrtAm: now,
        }).returning({ id: touchpoint.id })
        if (!created) throw new Error('PUBLISH_TOUCHPOINT_RECEIPT_MISSING')
        touchpointId = created.id
      }
      const [executedAction] = await tx.update(aktion).set({ status: 'ausgefuehrt', ausgefuehrtAm: now }).where(and(
        eq(aktion.tenantId, tenantId),
        eq(aktion.truthStatus, 'verified'),
        eq(aktion.isDemo, false),
        eq(aktion.id, input.actionId),
        eq(aktion.status, 'freigegeben')
      )).returning({ id: aktion.id })
      if (!executedAction) throw new Error('PUBLISH_ACTION_STATE_CONFLICT_AFTER_PROVIDER')
      const settled = await tx.update(marketingPublishJob).set({
        status: 'succeeded',
        externalMediaId: publishedMediaId,
        completedAt: now,
        errorCode: null,
        aktualisiertAm: now,
      }).where(and(
        eq(marketingPublishJob.tenantId, tenantId),
        eq(marketingPublishJob.id, reservation.job.id),
        eq(marketingPublishJob.status, 'publishing')
      )).returning({ id: marketingPublishJob.id })
      if (settled.length !== 1) throw new Error('PUBLISH_JOB_SETTLEMENT_FAILED')
      return touchpointId
    })

    return NextResponse.json({
      ok: true,
      message: 'Erfolgreich auf Instagram veröffentlicht.',
      touchpointId: completed,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    await settleFailedJob(tenantId, reservation.job.id, !!containerId, error, mediaId)
    return jsonError(containerId ? 'PUBLISH_UNCERTAIN' : 'PUBLISH_FAILED', containerId ? 409 : 502)
  }
}
