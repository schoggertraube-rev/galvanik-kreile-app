import { resolveAuthorization, type AuthorizationSnapshot } from '@/lib/server/authorization'

const FIXED_TENANT_ID = 'galvanik-kreile'

function hasMarketingRead(actor: AuthorizationSnapshot): boolean {
  return actor.permissions.includes('perm_view_customers') && actor.permissions.includes('perm_view_prices')
}

export async function requireMarketingRead(): Promise<AuthorizationSnapshot> {
  const auth = await resolveAuthorization()
  if (!auth.ok || auth.data.tenantId !== FIXED_TENANT_ID || !hasMarketingRead(auth.data)) {
    throw new Error('AUTH_ERROR: Forbidden')
  }
  return auth.data
}

export async function requireMarketingWrite(): Promise<AuthorizationSnapshot> {
  const actor = await requireMarketingRead()
  if (!actor.permissions.includes('perm_data_customers')) {
    throw new Error('AUTH_ERROR: Forbidden')
  }
  return actor
}
