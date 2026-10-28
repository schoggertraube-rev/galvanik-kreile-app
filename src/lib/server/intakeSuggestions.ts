import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { berlinCalendarDay, plusWorkingDays, previousWorkingDay, workingDaysBetween } from "@/lib/domain/workingDays";
import type {
  IntakePriceCase,
  IntakePriceSuggestion,
  IntakeSuggestionPositionInput,
  IntakeSuggestions,
  IntakeSuggestionsInput,
  IntakeTermSuggestion,
} from "@/lib/intakeSuggestionsContract";

export type { IntakeSuggestions, IntakeSuggestionsInput } from "@/lib/intakeSuggestionsContract";

type CatalogRow = {
  id: string;
  name: string;
  surface: string;
  unit: string;
  net_price_cents: number | string;
  standard_lead_time_working_days: number | string;
};

type HistoryRow = {
  customer_id: string;
  customer_name: string;
  item_name: string;
  catalog_service_id: string | null;
  surface_requested: string;
  unit: string | null;
  quantity: number | string;
  unit_price_cents: number | string;
  invoice_date: string;
};

type PriceCandidate = {
  customerId: string;
  customerName: string;
  name: string;
  catalogServiceId: string | null;
  surface: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  invoiceDate: string;
};

const SURFACE_LEAD_DAYS: Readonly<Record<string, number>> = {
  verchromen: 5,
  vernickeln: 4,
  verzinken: 3,
};

function integer(value: number | string, code: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(code);
  return parsed;
}

function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedUnit(value: string | null): string {
  return normalized(value?.trim() || "Stück");
}

function sharedWord(left: string, right: string): boolean {
  const rightWords = new Set(normalized(right).split(" ").filter((word) => word.length >= 4));
  return normalized(left).split(" ").some((word) => word.length >= 4 && rightWords.has(word));
}

function samePart(position: IntakeSuggestionPositionInput, candidate: PriceCandidate): boolean {
  return position.catalogServiceId
    ? position.catalogServiceId === candidate.catalogServiceId
    : candidate.catalogServiceId === null && normalized(position.name) === normalized(candidate.name);
}

function sameSurfaceAndUnit(position: IntakeSuggestionPositionInput, candidate: PriceCandidate): boolean {
  return normalized(position.surfaceRequested) === normalized(candidate.surface)
    && normalizedUnit(position.unit) === normalizedUnit(candidate.unit);
}

function priceCase(candidate: PriceCandidate, kind: "gleich" | "aehnlich"): IntakePriceCase {
  return {
    kind,
    customerName: candidate.customerName,
    partName: candidate.name,
    surface: candidate.surface,
    quantity: candidate.quantity,
    invoiceDate: candidate.invoiceDate,
    unitPriceCents: candidate.unitPriceCents,
  };
}

export function choosePriceSuggestion(
  position: IntakeSuggestionPositionInput,
  customerId: string | null,
  history: PriceCandidate[],
  catalog: CatalogRow | null,
): IntakePriceSuggestion | null {
  const equal = customerId
    ? history.filter((candidate) => candidate.customerId === customerId && sameSurfaceAndUnit(position, candidate) && samePart(position, candidate))
    : [];
  if (equal[0]) {
    const unitPriceCents = equal[0].unitPriceCents;
    return {
      positionKey: position.key,
      source: "gleich",
      unit: position.unit?.trim() || equal[0].unit || "Stück",
      unitPriceCents,
      lineTotalCents: unitPriceCents * position.quantity,
      caseCount: equal.length,
      cases: equal.slice(0, 5).map((candidate) => priceCase(candidate, "gleich")),
    };
  }

  const similar = history.filter((candidate) => sameSurfaceAndUnit(position, candidate)
    && (position.catalogServiceId
      ? position.catalogServiceId === candidate.catalogServiceId
      : candidate.catalogServiceId === null && sharedWord(position.name, candidate.name)));
  if (similar.length >= 3) {
    const prices = similar.map((candidate) => candidate.unitPriceCents).sort((a, b) => a - b);
    const middle = Math.floor(prices.length / 2);
    const unitPriceCents = prices.length % 2 === 1 ? prices[middle] : Math.round((prices[middle - 1] + prices[middle]) / 2);
    return {
      positionKey: position.key,
      source: "aehnlich",
      unit: position.unit?.trim() || similar[0].unit || "Stück",
      unitPriceCents,
      lineTotalCents: unitPriceCents * position.quantity,
      caseCount: similar.length,
      cases: similar.slice(0, 5).map((candidate) => priceCase(candidate, "aehnlich")),
    };
  }

  if (!catalog) return null;
  const unitPriceCents = integer(catalog.net_price_cents, "INTAKE_CATALOG_PRICE_INVALID");
  return {
    positionKey: position.key,
    source: "katalog",
    unit: catalog.unit,
    unitPriceCents,
    lineTotalCents: unitPriceCents * position.quantity,
    caseCount: 1,
    cases: [{
      kind: "katalog",
      customerName: "Leistungskatalog",
      partName: catalog.name,
      surface: catalog.surface,
      quantity: null,
      invoiceDate: null,
      unitPriceCents,
    }],
  };
}

export function calculateTermSuggestion(input: {
  today: string;
  wishDate: string | null;
  positions: IntakeSuggestionPositionInput[];
  catalogById: ReadonlyMap<string, CatalogRow>;
  dailyOutputEur: number;
}): IntakeTermSuggestion | null {
  const eligible = input.positions.filter((position) => position.surfaceRequested.trim()
    && normalized(position.surfaceRequested) !== "noch zu klaren");
  if (eligible.length === 0) return null;

  let maximumLead = 0;
  let leadSurface = eligible[0].surfaceRequested.trim();
  for (const position of eligible) {
    const catalog = position.catalogServiceId ? input.catalogById.get(position.catalogServiceId) : undefined;
    const lead = catalog
      ? integer(catalog.standard_lead_time_working_days, "INTAKE_CATALOG_LEAD_INVALID")
      : SURFACE_LEAD_DAYS[normalized(position.surfaceRequested)] ?? 3;
    if (lead >= maximumLead) {
      maximumLead = lead;
      leadSurface = position.surfaceRequested.trim();
    }
  }

  const orderValueCents = eligible.reduce((sum, position) => sum + position.quantity * (position.unitPriceCents ?? 0), 0);
  const dailyOutputCents = input.dailyOutputEur * 100;
  const effortDays = Math.max(1, Math.ceil(orderValueCents / dailyOutputCents));
  const achievableDate = plusWorkingDays(input.today, 1 + maximumLead + effortDays);
  if (!achievableDate) throw new Error("INTAKE_ACHIEVABLE_DATE_INVALID");

  const effectiveWish = input.wishDate ? previousWorkingDay(input.wishDate) : null;
  const bufferWorkingDays = effectiveWish ? workingDaysBetween(achievableDate, effectiveWish) : null;
  const rating = bufferWorkingDays === null
    ? null
    : bufferWorkingDays > 2
      ? "passt" as const
      : bufferWorkingDays >= 0
        ? "knapp" as const
        : "nicht_machbar" as const;

  return {
    achievableDate,
    wishDate: input.wishDate,
    rating,
    bufferWorkingDays,
    reasons: [
      { kind: "lead", text: `${leadSurface}: ${maximumLead} Arbeitstage Durchlauf` },
      { kind: "effort", text: `${effortDays} Aufwandstage` },
    ],
  };
}

function validInput(input: IntakeSuggestionsInput): boolean {
  return (input.customerId === null || /^[0-9a-f-]{36}$/i.test(input.customerId))
    && (input.wishDate === null || /^\d{4}-\d{2}-\d{2}$/.test(input.wishDate))
    && input.positions.length >= 1
    && input.positions.length <= 20
    && input.positions.every((position) => position.key.length >= 1
      && position.key.length <= 80
      && (position.catalogServiceId === null || /^[0-9a-f-]{36}$/i.test(position.catalogServiceId))
      && position.name.trim().length >= 2
      && position.name.trim().length <= 160
      && Number.isSafeInteger(position.quantity)
      && position.quantity >= 1
      && position.quantity <= 1_000_000
      && position.surfaceRequested.trim().length >= 2
      && position.surfaceRequested.trim().length <= 160
      && (position.unit === null || position.unit.trim().length <= 40)
      && (position.unitPriceCents === null || Number.isSafeInteger(position.unitPriceCents) && position.unitPriceCents >= 0));
}

export async function readIntakeSuggestions(
  authorization: AuthorizationSnapshot,
  input: IntakeSuggestionsInput,
): Promise<IntakeSuggestions> {
  if (!validInput(input)) throw new Error("INTAKE_SUGGESTION_INPUT_INVALID");
  const canReadMoney = authorization.areas?.includes("geld") === true;

  return withPrivilegedTenantTransaction(authorization, async (tx) => {
    const [settings, catalogRows, historyRows] = await Promise.all([
      tx.execute<{ tagesleistung_eur: number | string }>(sql`
        SELECT tagesleistung_eur
        FROM public.company_settings
        WHERE tenant_id = ${authorization.tenantId}
        ORDER BY updated_at DESC, id
        LIMIT 2
      `),
      tx.execute<CatalogRow>(sql`
        SELECT id::text, name, surface, unit, net_price_cents, standard_lead_time_working_days
        FROM public.catalog_services
        WHERE tenant_id = ${authorization.tenantId}
          AND active = true
        ORDER BY name, surface, id
      `),
      canReadMoney ? tx.execute<HistoryRow>(sql`
        SELECT invoice.customer_id::text AS customer_id,
               coalesce(nullif(invoice.snapshot->'customer'->>'companyName', ''), invoice.snapshot->'customer'->>'name') AS customer_name,
               item.name AS item_name,
               item.catalog_service_id::text AS catalog_service_id,
               item.surface_requested,
               item.unit,
               item.quantity,
               (line.value->>'unitNetAmountCents')::bigint AS unit_price_cents,
               to_char(invoice.issued_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS invoice_date
        FROM public.invoices invoice
        CROSS JOIN LATERAL jsonb_array_elements(invoice.snapshot->'lines') line(value)
        JOIN public.items item
          ON item.tenant_id = invoice.tenant_id
         AND item.id = line.value->>'itemId'
        WHERE invoice.tenant_id = ${authorization.tenantId}
          AND invoice.contract_version = 1
          AND invoice.status = 'issued'
          AND invoice.cancelled_at IS NULL
          AND invoice.issued_at >= statement_timestamp() - interval '24 months'
          AND jsonb_typeof(invoice.snapshot->'lines') = 'array'
          AND jsonb_typeof(line.value->'unitNetAmountCents') = 'number'
          AND item.surface_requested IS NOT NULL
        ORDER BY invoice.issued_at DESC, invoice.id, item.id
        LIMIT 500
      `) : Promise.resolve([]),
    ]);

    if (settings.length !== 1) throw new Error("INTAKE_DAILY_OUTPUT_MISSING_OR_AMBIGUOUS");
    const dailyOutputEur = integer(settings[0].tagesleistung_eur, "INTAKE_DAILY_OUTPUT_INVALID");
    if (dailyOutputEur < 1 || dailyOutputEur > 99_999) throw new Error("INTAKE_DAILY_OUTPUT_INVALID");
    const catalogById = new Map(catalogRows.map((row) => [row.id, row]));
    const history: PriceCandidate[] = historyRows.map((row) => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      name: row.item_name,
      catalogServiceId: row.catalog_service_id,
      surface: row.surface_requested,
      unit: row.unit?.trim() || "Stück",
      quantity: integer(row.quantity, "INTAKE_HISTORY_QUANTITY_INVALID"),
      unitPriceCents: integer(row.unit_price_cents, "INTAKE_HISTORY_PRICE_INVALID"),
      invoiceDate: row.invoice_date,
    }));

    return {
      term: calculateTermSuggestion({
        today: berlinCalendarDay(),
        wishDate: input.wishDate,
        positions: input.positions,
        catalogById,
        dailyOutputEur,
      }),
      prices: canReadMoney
        ? input.positions.flatMap((position) => {
            const suggestion = choosePriceSuggestion(
              position,
              input.customerId,
              history,
              position.catalogServiceId ? catalogById.get(position.catalogServiceId) ?? null : null,
            );
            return suggestion ? [suggestion] : [];
          })
        : [],
    };
  });
}
