import { NextResponse } from 'next/server'
import { and, asc, eq, like } from 'drizzle-orm'
import { db } from '@/db'
import { emailTemplates } from '@/db/schema'
import { resolveAuthorization } from '@/lib/server/authorization'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const authorization = await resolveAuthorization()
  if (!authorization.ok) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  if (!authorization.data.permissions.includes('perm_data_customers') || authorization.data.tenantId !== 'galvanik-kreile') {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN' }, {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const purpose = new URL(request.url).searchParams.get('purpose')
  if (purpose !== 'status') {
    return NextResponse.json({ ok: false, code: 'INVALID_REQUEST' }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const templates = await db.select({
    id: emailTemplates.id,
    templateKey: emailTemplates.templateKey,
    name: emailTemplates.name,
  }).from(emailTemplates)
    .where(and(
      eq(emailTemplates.tenantId, authorization.data.tenantId),
      like(emailTemplates.templateKey, 'status_%')
    ))
    .orderBy(asc(emailTemplates.name))

  return NextResponse.json({ ok: true, templates }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
