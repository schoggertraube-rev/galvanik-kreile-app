import 'server-only';
import {hasAuthorizationArea,type AccessArea,type PermissionKey} from '@/lib/auth/authorizationContract';
import type {AuthorizationSnapshot} from './authorization';

/** PL22.11.05:30: read capabilities are not a session or command identity.
 * Keep this pure adapter independent of session resolution and database setup. */
export type AuthorizedReadContext=Readonly<{
 tenantId:string;
 permissions:readonly PermissionKey[];
 canReadArea:(area:AccessArea)=>boolean;
}>;
export function authorizationReadContext(authorization:AuthorizationSnapshot):AuthorizedReadContext{
 return {tenantId:authorization.tenantId,permissions:authorization.permissions,canReadArea:area=>hasAuthorizationArea(authorization,area)};
}
