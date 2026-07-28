import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();

function source(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function firstIndex(text: string, needle: string): number {
  const index = text.indexOf(needle);
  assert(index >= 0, `Expected '${needle}' in boundary contract source.`);
  return index;
}

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function assertServerActionsAreGated(relativePath: string): number {
  const text = source(relativePath);
  const sourceFile = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true);
  let count = 0;

  sourceFile.forEachChild((node) => {
    if (
      !ts.isFunctionDeclaration(node) ||
      !node.body ||
      !node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ||
      !node.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
    ) {
      return;
    }

    count += 1;
    const firstStatement = node.body.statements[0]?.getText(sourceFile) ?? "";
    assert(
      firstStatement.includes("isFoundationAreaEnabled") && firstStatement.includes("foundationUnavailableAction"),
      `${relativePath}:${node.name?.text ?? "anonymous"} is not fail-closed at its export boundary.`,
    );
  });

  return count;
}

const serviceWorker = source("public/sw.js");
assert(!serviceWorker.includes("indexedDB"), "Service worker must not persist API data in IndexedDB.");
assert(!serviceWorker.includes("api-cache"), "Service worker must not maintain an API cache.");
assert(serviceWorker.includes("function isSensitiveProductRequest"), "Service worker needs an explicit sensitive-request boundary.");
assert(serviceWorker.includes("url.pathname.startsWith('/api/')"), "Service worker must bypass API requests.");
assert(serviceWorker.includes("url.searchParams.has('_rsc')"), "Service worker must bypass RSC payloads.");
assert(serviceWorker.includes("text/x-component"), "Service worker must bypass React Server Component payloads.");

const appRoot = resolve(root, "src");
const registrationFiles = walk(appRoot).filter((file) => source(file.slice(root.length + 1).replace(/\\/g, "/")).includes("navigator.serviceWorker.register"));
assert(registrationFiles.length === 1, `Expected exactly one service-worker registration path, found ${registrationFiles.length}.`);
assert(registrationFiles[0].endsWith(join("components", "layout", "PwaRegister.tsx")), "PwaRegister must be the sole service-worker registration path.");

const mobileBottomNav = source("src/components/layout/MobileBottomNav.tsx");
assert(!mobileBottomNav.includes('href="/kundenservice"'), "Mobile navigation must not link to the unavailable customer-service route.");
assert(mobileBottomNav.includes("Service (später)"), "Unavailable customer service must be visibly labelled as unavailable.");

const realtime = source("src/components/layout/RealtimeSyncManager.tsx");
assert(realtime.includes('status: "disabled"'), "Realtime must expose only the disabled state pending W3 proof.");
assert(!realtime.includes("createClient"), "Realtime must not create a browser Supabase client pending W3 proof.");
assert(!realtime.includes("postgres_changes"), "Realtime must not subscribe to database changes pending W3 proof.");

const parkedCall = source("src/contexts/ParkedCallContext.tsx");
assert(!parkedCall.includes("localStorage"), "Parked calls must not restore or persist browser-local customer data pending W3 proof.");
assert(parkedCall.includes("activeParkedCall: null"), "Parked calls must remain inert pending W3 proof.");

const telemetry = source("src/lib/tracking/tracking.ts");
assert(!/^\s*import\s/m.test(telemetry), "Telemetry unavailable adapter must be import-free.");
for (const forbiddenMarker of ["Math.random", "localStorage", "OfflineManager", "logUiEvent", "fetch("]) {
  assert(!telemetry.includes(forbiddenMarker), `Telemetry unavailable adapter must not retain ${forbiddenMarker}.`);
}
assert(telemetry.includes("export function trackUiEvent"), "Telemetry must retain only the unavailable compatibility call shape.");

const photoService = source("src/lib/services/photoService.ts");
assert(!/^\s*import\s/m.test(photoService), "Photo unavailable adapter must be import-free.");
for (const forbiddenMarker of ["upload(", "getPublicUrl", "base64", "eventsRepository", "createClient", "fetch("]) {
  assert(!photoService.includes(forbiddenMarker), `Photo unavailable adapter must not retain ${forbiddenMarker}.`);
}
assert(photoService.includes("PhotoServiceNotConfiguredError"), "Photo service must reject with its explicit unavailable contract.");

const foundationGate = source("src/lib/server/foundationGate.ts");
assert(foundationGate.includes("FOUNDATION_CAPABILITIES"), "Foundation boundaries need named typed capabilities.");
assert(foundationGate.includes("FOUNDATION_CAPABILITY_ALLOWLIST"), "Foundation boundaries need a per-capability allowlist.");
assert(!foundationGate.includes("function isFoundationAreaEnabled(_area: string): boolean {\n  return false;\n}"), "Foundation boundaries must not use a global return-false gate.");

const guardedRepositories = [
  ["src/lib/repositories/itemsRepository.ts", "isItemsRepositoryEnabled"],
  ["src/lib/repositories/timelineRepository.ts", "isTimelineRepositoryEnabled"],
] as const;

for (const [relativePath, enabledGuard] of guardedRepositories) {
  const repository = source(relativePath);
  assert(repository.includes(`function ${enabledGuard}(): boolean {\n  return false;\n}`), `${relativePath} must stay disabled until its data contract is proven.`);
}

for (const relativePath of [
  "src/lib/repositories/bathsRepository.ts",
  "src/lib/repositories/bathMeasurementsRepository.ts",
]) {
  const repository = source(relativePath);
  assert(repository.includes('foundationUnavailableAction("Bäder und Messwerte"'), `${relativePath} must reject until its data contract is proven.`);
  assert(!repository.includes("new Map<"), `${relativePath} must not manufacture an in-memory data fallback.`);
  assert(!repository.includes("NEXT_PUBLIC_DATA_PROVIDER"), `${relativePath} must not switch to an unproven browser data provider.`);
}

const offlineOutbox = source("src/lib/offline/OfflineOutbox.ts");
assert(offlineOutbox.includes("function isOfflineDestructiveRecoveryEnabled(): boolean {\n  return false;\n}"), "Offline outbox deletion must remain disabled.");
assert(firstIndex(offlineOutbox, "if (!isOfflineDestructiveRecoveryEnabled())") < firstIndex(offlineOutbox, "store.delete"), "Offline outbox must guard before deleting a local entry.");
assert(!offlineOutbox.includes("catch {\n      return [];"), "A failed outbox read must not become an empty queue.");

const offlineSync = source("src/lib/offline/idbSync.ts");
assert(!/^\s*import\s/m.test(offlineSync), "Offline sync unavailable adapter must be import-free.");
for (const forbiddenMarker of ["indexedDB", "localStorage", "Math.random", "store.add", "store.put", "store.delete"]) {
  assert(!offlineSync.includes(forbiddenMarker), `Offline sync unavailable adapter must not retain ${forbiddenMarker}.`);
}
assert(offlineSync.includes("OfflineSyncNotConfiguredError"), "Offline sync must reject with its explicit unavailable contract.");

const indexedDbHelper = source("src/lib/offline/IndexedDBHelper.ts");
assert(!indexedDbHelper.includes("deleteObjectStore"), "Repair code must not delete legacy IndexedDB stores.");
assert(indexedDbHelper.includes("function isOfflineQueueContractEnabled(): boolean {\n  return false;\n}"), "Offline queue writes/deletes must remain disabled.");

const offlineManager = source("src/lib/offline/OfflineManager.ts");
assert(!offlineManager.includes("catch {\n      return 0;"), "A failed queue read must not become zero pending changes.");
assert(!offlineManager.includes("removeFromQueue"), "Offline manager must not delete queued changes pending W3 proof.");
assert(!offlineManager.includes("localStorage"), "Offline manager must not simulate offline state with browser storage.");

const unavailableApiRoutes = [
  ["src/app/api/erfassung/customer-search/route.ts", "Kundensuche in der Erfassung"],
  ["src/app/api/erfassung/scan-status/[id]/route.ts", "Scan-Status"],
  ["src/app/api/erfassung/scan-upload/route.ts", "Scan-Upload"],
  ["src/app/api/erfassung/item-photo-upload/route.ts", "Teilefoto-Upload"],
  ["src/app/api/ocr-process/route.ts", "OCR-Verarbeitung"],
  ["src/app/api/cron/send-feedback/route.ts", "Feedback-Versand"],
  ["src/app/api/erfassung/customer-enrich/route.ts", "Kundenerkennung"],
  ["src/app/api/erfassung/freetext-extract/route.ts", "Freitext-Extraktion"],
  ["src/app/api/erfassung/inquiry-extract/route.ts", "Anfrage-Extraktion"],
  ["src/app/api/erfassung/notes-extract/route.ts", "Notiz-Extraktion"],
  ["src/app/api/email/send/route.ts", "E-Mail-Versand"],
  ["src/app/api/morning-message/route.ts", "Morgenhinweise"],
  ["src/app/api/payments/mollie/create/route.ts", "Zahlungsanforderung"],
  ["src/app/api/today/has-deadlines/route.ts", "Tagesfristen"],
  ["src/app/api/today/important/route.ts", "Tagesprioritäten"],
  ["src/app/api/today/status/route.ts", "Tagesstatus"],
  ["src/app/api/today/timeline/route.ts", "Tageschronik"],
  ["src/app/api/users/route.ts", "Benutzer-API"],
] as const;

for (const [relativePath, area] of unavailableApiRoutes) {
  const route = source(relativePath);
  assert(route.includes(`foundationUnavailableResponse(\"${area}\"`), `${relativePath} must identify its unavailable product area.`);
  assert(!route.includes('from "@/db"') && !route.includes("from '@/db'"), `${relativePath} must not import the database behind a fail-closed boundary.`);
  assert(!route.includes("@supabase/supabase-js"), `${relativePath} must not initialize a Supabase client behind a fail-closed boundary.`);
}

const unavailablePages = [
  "src/app/page.tsx",
  "src/app/archive/page.tsx",
  "src/app/cockpit/jahresplan/page.tsx",
  "src/app/scan/page.tsx",
  "src/app/quotes/new/page.tsx",
  "src/app/station/[slug]/page.tsx",
  "src/app/customers/[id]/page.tsx",
  "src/app/orders/[id]/page.tsx",
  "src/app/warendurchlauf/galvanik/page.tsx",
  "src/app/warendurchlauf/wareneingang/page.tsx",
  "src/app/kunden-auftraege/page.tsx",
];

for (const relativePath of unavailablePages) {
  const page = source(relativePath);
  assert(page.includes("FoundationUnavailable"), `${relativePath} must render the explicit unavailable state.`);
  assert(!page.includes("@/app/actions"), `${relativePath} must not import an inactive server action.`);
  assert(!page.includes("@/lib/supabase"), `${relativePath} must not initialize an inactive Supabase path.`);
}

// These former widgets are not mounted by an active route today, but they used
// to claim local intake success, inferred station urgency, or local PDF/print
// completion. Keep their exports as static quarantine boundaries so a future
// import cannot silently restore a second operational path.
const staticallyQuarantinedComponents = [
  "src/components/intake/IntakeCompletionSummary.tsx",
  "src/components/warenausgang/WarenausgangQueue.tsx",
  "src/components/galvanik/GalvanikQueue.tsx",
  "src/components/galvanik/GalvanikOrderRow.tsx",
];
for (const relativePath of staticallyQuarantinedComponents) {
  const component = source(relativePath);
  assert(component.includes("FoundationUnavailable"), `${relativePath} must remain an explicit static quarantine boundary.`);
  assert(!component.includes("window.print"), `${relativePath} must not invoke browser printing.`);
  assert(!component.includes("processIntake"), `${relativePath} must not create an order from a dormant client flow.`);
  assert(!component.includes("generateDeliveryNote"), `${relativePath} must not claim local delivery-note generation.`);
  assert(!component.includes("EntityDecisionOverlay"), `${relativePath} must not expose an unverified process decision path.`);
}

const dbIndex = source("src/db/index.ts");
assert(dbIndex.includes("function createDatabase()"), "Database construction must be lazy.");
assert(dbIndex.includes("function getDatabase(): Database"), "Database access must have a single lazy resolver.");
assert(dbIndex.includes("export const db = new Proxy"), "Repository imports must use the lazy database proxy.");
assert(firstIndex(dbIndex, "function createDatabase()") < firstIndex(dbIndex, "export const db = new Proxy"), "Database construction must not execute during module import.");

const permissionsContext = source("src/lib/auth/PermissionsContext.tsx");
assert(!permissionsContext.includes("createClient"), "Permissions must use the signed server snapshot, not a browser Supabase auth subscription.");

const browserSupabaseClient = source("src/lib/supabase/client.ts");
assert(!browserSupabaseClient.includes("export const supabase"), "A browser Supabase client must not be created eagerly on module import.");
assert(browserSupabaseClient.includes("export function createClient()"), "Quarantined legacy modules may only receive a lazy browser-client factory.");

const forbiddenBrowserTransportMarkers = [
  "@/lib/supabase/client",
  ".rpc(",
  ".functions.invoke(",
  ".storage.from(",
  "postgres_changes",
];
const browserTransportBoundaryFiles = [
  "src/features/analyse/hooks/useGlobalSearch.ts",
  "src/features/analyse/hooks/useWerkstattPuls.ts",
  "src/features/analyse/hooks/useKiInsight.ts",
  "src/components/layout/GlobalSearch.tsx",
  "src/components/kommunikation/kommandozentrale/hooks/useClientDossier.ts",
  "src/app/kommunikation/KommunikationClient.tsx",
  "src/lib/search/globalSearch.ts",
  "src/lib/useOrderLive.ts",
  "src/lib/email/resendAdapter.ts",
  "src/lib/payments/mollieAdapter.ts",
  "src/components/orders/OrderOverlay.tsx",
  "src/components/orders/StatusMailDrawer.tsx",
  "src/components/orders/PaymentDrawer.tsx",
  "src/components/orders/ItemDrawer.tsx",
];
for (const relativePath of browserTransportBoundaryFiles) {
  const file = source(relativePath);
  for (const marker of forbiddenBrowserTransportMarkers) {
    assert(!file.includes(marker), `${relativePath} must not retain a browser-side Supabase transport (${marker}).`);
  }
}

const customerActions = source("src/app/actions/customers.actions.ts");
assert(customerActions.includes("export type CustomerListDto"), "Customer list must have an explicit minimal DTO.");
assert(customerActions.includes('checkAppPermission("perm_view_customers")'), "Customer list must require explicit customer-view permission.");
assert(!customerActions.includes("Capture%"), "Customer and order visibility must not diverge through a name heuristic.");
assert(!customerActions.slice(customerActions.indexOf("function mapCustomerListDto"), customerActions.indexOf("function mapDbCustomer")).includes("paymentProfile"), "Customer list DTO must not expose payment profiles.");

const orderActions = source("src/app/actions/orders.actions.ts");
const getOrdersDbSource = orderActions.slice(orderActions.indexOf("export async function getOrdersDb"), orderActions.indexOf("export async function getOrderCountDb"));
const getOrderCountSource = orderActions.slice(orderActions.indexOf("export async function getOrderCountDb"), orderActions.indexOf("export async function createOrderDb"));
assert(getOrdersDbSource.includes('checkAppPermission("perm_data_orders")'), "Active order reads must require the order-data permission.");
assert(getOrderCountSource.includes('checkAppPermission("perm_data_orders")'), "Active order counts must require the order-data permission.");
assert(orderActions.includes('if (!isFoundationAreaEnabled("Auftragsprozess"))'), "Process changes must remain fail-closed until W1 receipts are proven.");
assert(orderActions.includes("expectedStation: string"), "Canonical process commands must carry the station the user observed.");
assert(orderActions.includes("expectedStatus: string"), "Canonical process commands must carry the status the user observed.");
assert(orderActions.includes("clientEventId: string"), "Canonical process commands must carry a stable retry event ID.");
assert(orderActions.includes("clientEventId,"), "Process receipts must persist the stable retry event ID.");
assert(orderActions.includes("station: newStation"), "Canonical process transition must update both station columns atomically.");
assert(orderActions.includes("completedDate: transitionAt"), "Final canonical process transition must write a completion timestamp.");
assert(orderActions.includes("fromStation: currentStation"), "Completion evidence must retain the station that was completed.");
assert(orderActions.includes("export async function createOrderFromScan(_params"), "Capture-to-order must be fail-closed at its public action boundary.");
assert(orderActions.includes('if (!isFoundationAreaEnabled("Risikoauswertung"))'), "Risk labelling must remain disabled without its performance evidence contract.");

const ordersPage = source("src/app/orders/page.tsx");
assert(!ordersPage.includes("priorityComputed") && !ordersPage.includes("surfaceKey"), "The active order list must not invent urgency or surface chains from legacy fields/free text.");

const gatedActionFiles = [
  "src/app/global-search-actions.ts",
  "src/app/actions/ai-enrichment.actions.ts",
  "src/app/actions/performance.actions.ts",
  "src/app/actions/pdf.actions.ts",
  "src/app/actions/vorlage.actions.ts",
  "src/app/baeder/actions.ts",
  "src/app/buchhaltung/analysis.actions.ts",
  "src/app/buchhaltung/search-actions.ts",
  "src/app/buchhaltung/periodenabschluss/actions.ts",
  "src/app/cockpit/actions.ts",
  "src/app/marketing/analysis.actions.ts",
  "src/app/marketing/marketing.actions.ts",
  "src/app/marketing/aktion/actions.ts",
  "src/app/marketing/attribution/actions.ts",
  "src/app/marketing/einwilligungen/actions.ts",
  "src/app/marketing/kanaele/actions.ts",
  "src/app/marketing/segmente/actions.ts",
  "src/features/analyse/analyse.actions.ts",
];

const actionCount = gatedActionFiles.reduce((sum, relativePath) => sum + assertServerActionsAreGated(relativePath), 0);
assert(actionCount >= 64, `Expected at least 64 fail-closed action boundaries, found ${actionCount}.`);

console.log(`Foundation boundary contract passed (${actionCount} server-action gates, one static-only service worker).`);
