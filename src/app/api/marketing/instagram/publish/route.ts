import { NextResponse } from 'next/server'
import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
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

function validStorageLocation(bucket: string | null, path: string): bucket is string {
  return !!bucket && /^[a-z0-9][a-z0-9._-]{1,62}$/.test(bucket) && path.length > 0 && path.length <= 1_024 &&
    !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..') && !/[\u0000-\u001f\u007f]/.test(path)
}

function jsonError(code: string, status: number) {
  return NextResponse.json({ ok: false, code }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function loadJob(actionId: string): Promise<PublishJob | undefined> {
  return (await db.select().from(marketingPublishJob).where(eq(marketingPublishJob.aktionId, actionId)).limit(1))[0]
}

async function reservePublishJob(input: PublishInput, channelId: string): Promise<
  | { kind: 'claimed'; job: PublishJob }
  | { kind: 'succeeded'; job: PublishJob }
  | { kind: 'in_progress' }
  | { kind: 'uncertain' }
> {
  await db.insert(marketingPublishJob).values({
    aktionId: input.actionId,
    assetId: input.assetId,
    kanalId: channelId,
    status: 'reserved',
  }).onConflictDoNothing({ target: marketingPublishJob.aktionId })

  let job = await loadJob(input.actionId)
  if (!job || job.assetId !== input.assetId || job.kanalId !== channelId) return { kind: 'uncertain' }
  if (job.status === 'succeeded') return { kind: 'succeeded', job }
  if (job.status === 'uncertain') return { kind: 'uncertain' }
  if (job.externalContainerId) {
    await db.update(marketingPublishJob).set({
      status: 'uncertain',
      errorCode: 'EXTERNAL_CONTAINER_ALREADY_EXISTS',
      aktualisiertAm: new Date(),
    }).where(eq(marketingPublishJob.id, job.id))
    return { kind: 'uncertain' }
  }
  if (job.status === 'publishing') {
    if (job.claimedAt && job.claimedAt.getTime() < Date.now() - STALE_JOB_BEFORE_MS) {
      await db.update(marketingPublishJob).set({
        status: 'uncertain',
        errorCode: 'STALE_PUBLISHING_JOB',
        aktualisiertAm: new Date(),
      }).where(and(
        eq(marketingPublishJob.id, job.id),
        eq(marketingPublishJob.status, 'publishing'),
        lt(marketingPublishJob.claimedAt, new Date(Date.now() - STALE_JOB_BEFORE_MS))
      ))
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
    eq(marketingPublishJob.id, job.id),
    inArray(marketingPublishJob.status, ['reserved', 'failed']),
    isNull(marketingPublishJob.externalContainerId)
  )).returning()
  if (!claimed) return { kind: 'in_progress' }
  job = claimed
  return { kind: 'claimed', job }
}

async function settleFailedJob(jobId: string, uncertain: boolean, error: unknown, mediaId?: string): Promise<void> {
  const errorCode = error instanceof MetaInstagramError ? error.code : 'INSTAGRAM_PUBLISH_INTERNAL_ERROR'
  try {
    await db.update(marketingPublishJob).set({
      status: uncertain ? 'uncertain' : 'failed',
      externalMediaId: mediaId || null,
      completedAt: new Date(),
      errorCode: errorCode.slice(0, 120),
      aktualisiertAm: new Date(),
    }).where(eq(marketingPublishJob.id, jobId))
  } catch {
    // The caller still fails closed. A missing settlement must never trigger a blind retry.
  }
}

export async function POST(request: Request) {
  try {
    await requireMarketingWrite()
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
    .leftJoin(kanal, eq(aktion.kanalId, kanal.id))
    .where(eq(aktion.id, input.actionId))
    .limit(1)
  if (!record || !record.channelId) return jsonError('ACTION_NOT_FOUND', 404)
  if (record.type !== 'post' || record.actionStatus !== 'freigegeben') return jsonError('ACTION_NOT_APPROVED', 409)

  const content = objectValue(record.content)
  if (textValue(content.assetId) !== input.assetId) return jsonError('ASSET_NOT_APPROVED', 409)
  const caption = buildCaption(record.title, record.content)
  if (!caption) return jsonError('ACTION_CONTENT_INVALID', 409)
  if (caption !== input.expectedCaption) return jsonError('ACTION_CONTENT_NOT_APPROVED', 409)

  const [asset] = await db.select().from(marketingAsset).where(eq(marketingAsset.id, input.assetId)).limit(1)
  if (!asset || asset.freigabeMarketing !== true || !validStorageLocation(asset.storageBucket, asset.storagePfad)) {
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
    pageAccessToken = decryptMarketingToken(record.accessTokenEncrypted)
  } catch {
    return jsonError('CONFIGURATION_MISSING', 503)
  }

  const reservation = await reservePublishJob(input, record.channelId)
  if (reservation.kind === 'succeeded') {
    const existingTouchpoint = (await db.select({ id: touchpoint.id }).from(touchpoint)
      .where(eq(touchpoint.aktionId, input.actionId)).limit(1))[0]
    return NextResponse.json({
      ok: true,
      message: 'Instagram-Beitrag wurde bereits veröffentlicht.',
      touchpointId: existingTouchpoint?.id,
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
      eq(marketingPublishJob.id, reservation.job.id),
      eq(marketingPublishJob.status, 'publishing')
    )).returning({ id: marketingPublishJob.id })
    if (containerRecorded.length !== 1) throw new Error('PUBLISH_JOB_CONTAINER_RECORD_FAILED')

    await waitForMetaContainer(metaConfig, pageAccessToken, containerId)
    mediaId = await publishMetaMedia(metaConfig, pageAccessToken, igUserId, containerId)

    const completed = await db.transaction(async (tx) => {
      const now = new Date()
      const existing = await tx.select({ id: touchpoint.id }).from(touchpoint)
        .where(eq(touchpoint.aktionId, input.actionId)).limit(1)
      let touchpointId: string
      if (existing[0]) {
        touchpointId = existing[0].id
        await tx.update(touchpoint).set({
          kanalId: record.channelId,
          externeRef: mediaId,
          ausgefuehrtAm: now,
        }).where(eq(touchpoint.id, touchpointId))
      } else {
        const [created] = await tx.insert(touchpoint).values({
          aktionId: input.actionId,
          kanalId: record.channelId,
          externeRef: mediaId,
          utmCampaign: record.title.substring(0, 80).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
          utmSource: 'instagram',
          utmMedium: 'organic-social',
          ausgefuehrtAm: now,
        }).returning({ id: touchpoint.id })
        touchpointId = created.id
      }
      await tx.update(aktion).set({ status: 'ausgefuehrt', ausgefuehrtAm: now }).where(eq(aktion.id, input.actionId))
      const settled = await tx.update(marketingPublishJob).set({
        status: 'succeeded',
        externalMediaId: mediaId,
        completedAt: now,
        errorCode: null,
        aktualisiertAm: now,
      }).where(and(
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
    await settleFailedJob(reservation.job.id, !!containerId, error, mediaId)
    return jsonError(containerId ? 'PUBLISH_UNCERTAIN' : 'PUBLISH_FAILED', containerId ? 409 : 502)
  }
}
