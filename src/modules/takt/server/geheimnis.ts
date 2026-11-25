import 'server-only';
import {resolveAuthorization} from '@/lib/server/authorization';
import {hasValidCronCredential} from '@/lib/server/cronCredential';

export type TaktZugriff =
  | Readonly<{code: 'CRON'}>
  | Readonly<{code: 'LOGIN'; tenantId: string}>
  | Readonly<{code: 'DENIED'; status: 401 | 403}>;

/** A configured cron secret always takes precedence over the login route. */
export async function pruefeTaktZugriff(request: Request): Promise<TaktZugriff> {
  const configured = process.env.CRON_SECRET;
  if (configured) {
    if (!hasValidCronCredential(request.headers.get('authorization'), configured)) {
      return {code: 'DENIED', status: 401};
    }
    return {code: 'CRON'};
  }
  try {
    const result = await resolveAuthorization();
    if (!result.ok) return {code: 'DENIED', status: 401};
    if (!result.data.permissions.includes('perm_sys_diag')) return {code: 'DENIED', status: 403};
    return {code: 'LOGIN', tenantId: result.data.tenantId};
  } catch {
    return {code: 'DENIED', status: 401};
  }
}

/** The retired Cron route remains a tenant-bound diagnostic hand action. */
export async function pruefeTaktHandzugriff(): Promise<Extract<TaktZugriff, {code: 'LOGIN' | 'DENIED'}>> {
  try {
    const result = await resolveAuthorization();
    if (!result.ok) return {code: 'DENIED', status: 401};
    if (!result.data.permissions.includes('perm_sys_diag')) return {code: 'DENIED', status: 403};
    return {code: 'LOGIN', tenantId: result.data.tenantId};
  } catch {
    return {code: 'DENIED', status: 401};
  }
}
