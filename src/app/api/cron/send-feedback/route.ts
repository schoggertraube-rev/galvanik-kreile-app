import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { and, desc, eq, lte } from 'drizzle-orm'
import { db } from '@/db'
import { customers, orders } from '@/db/schema'
import { einwilligung, feedbackMail } from '@/db/schema_marketing'
import { sendTemplatedEmail } from '@/lib/server/emailDelivery'

export const runtime = 'nodejs'

const TENANT_ID = 'galvanik-kreile'
const MAX_BATCH = 50

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const header = request.headers.get('authorization') || ''
  if (!secret || secret.length < 32 || !header.startsWith('Bearer ')) return false
  const supplied = header.slice(7)
  const expectedBytes = Buffer.from(secret, 'utf8')
  const suppliedBytes = Buffer.from(supplied, 'utf8')
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.trim().length < 32) {
    return NextResponse.json({ ok: false, code: 'CRON_CONFIGURATION_MISSING' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  try {
    const now = new Date()
    const due = await db.select({
      id: feedbackMail.id,
      orderId: feedbackMail.auftragId,
      customerId: feedbackMail.kundeId,
      customerName: customers.name,
      customerEmail: customers.email,
      customerOptOut: customers.marketingOptOut,
      orderNumber: orders.orderNumber,
      orderTitle: orders.title,
    }).from(feedbackMail)
      .innerJoin(orders, and(
        eq(feedbackMail.auftragId, orders.id),
        eq(orders.tenantId, TENANT_ID)
      ))
      .innerJoin(customers, and(
        eq(feedbackMail.kundeId, customers.id),
        eq(customers.id, orders.customerId),
        eq(customers.tenantId, TENANT_ID)
      ))
      .where(and(
        eq(feedbackMail.tenantId, TENANT_ID),
        eq(feedbackMail.status, 'geplant'),
        eq(feedbackMail.einwilligungOk, true),
        lte(feedbackMail.geplantFuer, now)
      ))
      .limit(MAX_BATCH)

    const counts = { sent: 0, cancelled: 0, failed: 0, uncertain: 0, deferred: 0 }
    for (const mail of due) {
      if (!mail.customerEmail || !mail.orderId || !mail.customerId) {
        await db.update(feedbackMail).set({ status: 'fehler' }).where(and(
          eq(feedbackMail.id, mail.id),
          eq(feedbackMail.tenantId, TENANT_ID),
          eq(feedbackMail.status, 'geplant')
        ))
        counts.failed += 1
        continue
      }
      const currentConsent = await db.select({ status: einwilligung.status })
        .from(einwilligung)
        .where(and(
          eq(einwilligung.tenantId, TENANT_ID),
          eq(einwilligung.kundeId, mail.customerId),
          eq(einwilligung.kanal, 'email')
        ))
        .orderBy(desc(einwilligung.zeitpunkt))
        .limit(1)

      if (mail.customerOptOut === true || currentConsent[0]?.status !== 'erteilt') {
        await db.update(feedbackMail).set({ status: 'storniert' }).where(and(
          eq(feedbackMail.id, mail.id),
          eq(feedbackMail.tenantId, TENANT_ID),
          eq(feedbackMail.status, 'geplant')
        ))
        counts.cancelled += 1
        continue
      }
      const result = await sendTemplatedEmail({
        tenantId: TENANT_ID,
        to: mail.customerEmail,
        templateKey: 'feedback_request',
        variables: {
          kunde_name: mail.customerName,
          auftragsnummer: mail.orderNumber,
          auftragsbezeichnung: mail.orderTitle,
        },
        orderId: mail.orderId,
        customerId: mail.customerId,
        idempotencyKey: `feedback/${mail.id}`,
      })

      if (result.ok) {
        const updated = await db.update(feedbackMail).set({ status: 'gesendet', gesendetAm: now }).where(and(
          eq(feedbackMail.id, mail.id),
          eq(feedbackMail.tenantId, TENANT_ID),
          eq(feedbackMail.status, 'geplant')
        )).returning({ id: feedbackMail.id })
        if (updated.length === 1) counts.sent += 1
        else counts.uncertain += 1
      } else if (result.code === 'UNCERTAIN') {
        await db.update(feedbackMail).set({ status: 'versand_unsicher' }).where(and(
          eq(feedbackMail.id, mail.id),
          eq(feedbackMail.tenantId, TENANT_ID),
          eq(feedbackMail.status, 'geplant')
        ))
        counts.uncertain += 1
      } else if (result.code === 'PROVIDER_REJECTED') {
        await db.update(feedbackMail).set({ status: 'fehler' }).where(and(
          eq(feedbackMail.id, mail.id),
          eq(feedbackMail.tenantId, TENANT_ID),
          eq(feedbackMail.status, 'geplant')
        ))
        counts.failed += 1
      } else {
        counts.deferred += 1
      }
    }

    return NextResponse.json({ ok: true, processed: due.length, ...counts }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ ok: false, code: 'FEEDBACK_DELIVERY_UNAVAILABLE' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
