/**
 * S0 (D-ARCH-007 / D-ARCH-008 Naht 3): EINZIGE Quelle des Auslieferungs-Tenants.
 *
 * Das rohe String-Literal 'galvanik-kreile' darf NIRGENDWO sonst im Code stehen
 * (ESLint verbietet es). Den Tenant zu wechseln = nur diese eine Zeile aendern.
 *
 * Spaetere Naht (per Modul): der Tenant wird ueber TenantProvider/Context bzw.
 * resolveAuthorization() injiziert; Modul-Kerne kennen kein Literal und keine
 * Konstante mehr, sondern bekommen den Tenant hereingereicht.
 */
// Bewusst als `string` typisiert (kein `as const`): der Kern soll tenant-neutral
// sein — Funktionen duerfen nicht auf das Literal 'galvanik-kreile' verengen,
// sonst brechen Fremdmandanten-/Isolationstests und spaetere Injektion.
export const KREILE_TENANT_SLUG: string = 'galvanik-kreile';

export type TenantSlug = string;
