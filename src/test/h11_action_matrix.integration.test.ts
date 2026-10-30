// @vitest-environment node

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { getAuthorizationActionGrants, hasAuthorizationArea } from "@/lib/server/authorization";

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.H11_EXPECTED_DATABASE_URL;

if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("H11_LOCAL_DATABASE_REQUIRED: DATABASE_URL must equal H11_EXPECTED_DATABASE_URL");
}

const parsedUrl = new URL(DATABASE_URL);
if (
  parsedUrl.protocol !== "postgresql:"
  || parsedUrl.hostname !== "127.0.0.1"
  || !/^\d{4,5}$/.test(parsedUrl.port)
  || parsedUrl.pathname !== "/postgres"
  || parsedUrl.username !== "postgres"
) {
  throw new Error("H11_LOCAL_DATABASE_REQUIRED: expected the dedicated local replay database");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("H11_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

const readAppSessionSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession: readAppSessionSpy }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_noStore: vi.fn() }));

const TENANT = KREILE_TENANT_SLUG;
const USERS = {
  meister: "00000000-0000-4000-8000-00000000a111",
  werkstatt: "00000000-0000-4000-8000-00000000a112",
  developer: "00000000-0000-4000-8000-00000000a113",
} as const;
const CUSTOMER_EVENT_ID = "71111111-1111-4111-8111-111111111110";
const QUOTE_EVENT_ID = "71111111-1111-4111-8111-111111111111";
const INVOICE_ID = "71111111-1111-4111-8111-111111111112";
const CONTENT_ITEM_ID = "71111111-1111-4111-8111-111111111113";
const PAYMENT_EVENTS = {
  meister: "71111111-1111-4111-8111-111111111121",
  werkstatt: "71111111-1111-4111-8111-111111111122",
  developer: "71111111-1111-4111-8111-111111111123",
} as const;
const CONTENT_EVENTS = {
  meister: "71111111-1111-4111-8111-111111111131",
  werkstatt: "71111111-1111-4111-8111-111111111132",
  developer: "71111111-1111-4111-8111-111111111133",
} as const;

const sql = postgres(DATABASE_URL, { max: 3, prepare: false });
let customerId = "";

type UserKey = keyof typeof USERS;

function setSession(user: UserKey): void {
  readAppSessionSpy.mockResolvedValue({
    ok: true,
    session: {
      userId: USERS[user],
      tenantId: TENANT,
      role: user,
      displayName: `TEST H11 ${user}`,
      issuedAt: 4_102_444_800_000,
      expiresAt: 4_102_488_000_000,
    },
  });
}

const customerInput = {
  clientEventId: CUSTOMER_EVENT_ID,
  name: "TEST H11 Aktionsmatrix",
  customerType: "business" as const,
  companyName: "TEST H11 Aktionsmatrix GmbH",
  contactPerson: "TEST H11 Kontakt",
  email: "h11-aktionsmatrix@example.invalid",
  phone: "+49 000 111111",
  street: "Testweg 11",
  zipCode: "70173",
  city: "Stuttgart",
  country: "Deutschland",
  paymentPreference: "vorkasse",
  vatId: "DE111111111",
  notes: "Synthetischer H11-Replay-Vertrag",
};

async function authorizationFor(user: UserKey) {
  setSession(user);
  const { resolveAuthorization } = await import("@/lib/server/authorization");
  const result = await resolveAuthorization();
  expect(result.ok, user).toBe(true);
  if (!result.ok) throw new Error(`H11_AUTHORIZATION_FAILED:${user}:${result.reason}`);
  return result.data;
}

function customerContext(authorization: Awaited<ReturnType<typeof authorizationFor>>) {
  return {
    tenantId: authorization.tenantId,
    userId: authorization.userId,
    capabilities: {
      canCreateCustomer: getAuthorizationActionGrants(authorization).createCustomer,
      canManageMoney: hasAuthorizationArea(authorization, "geld"),
    },
  };
}

function quoteContext(authorization: Awaited<ReturnType<typeof authorizationFor>>) {
  const grants = getAuthorizationActionGrants(authorization);
  return {
    tenantId: authorization.tenantId,
    userId: authorization.userId,
    capabilities: {
      canCreateQuote: grants.createQuote,
      canReadQuote: hasAuthorizationArea(authorization, "geld") && hasAuthorizationArea(authorization, "auftraege"),
      canUpdateQuote: grants.createQuote,
      canConvertQuote: grants.createQuote,
    },
  };
}

beforeAll(async () => {
  await sql`
    INSERT INTO public.app_users (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES
      (${USERS.meister}::uuid, ${TENANT}, 'h11-meister@example.invalid', 'TEST H11 Meister', 'meister', true, now(), now()),
      (${USERS.werkstatt}::uuid, ${TENANT}, 'h11-werkstatt@example.invalid', 'TEST H11 Werkstatt', 'werkstatt', true, now(), now()),
      (${USERS.developer}::uuid, ${TENANT}, 'h11-developer@example.invalid', 'TEST H11 Entwickler', 'developer', true, now(), now())
    ON CONFLICT (id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      active = true,
      updated_at = now()
  `;
  await sql`
    INSERT INTO public.app_user_rights (tenant_id, user_id, bereich)
    VALUES
      (${TENANT}, ${USERS.meister}::uuid, 'auftraege'),
      (${TENANT}, ${USERS.meister}::uuid, 'eingang'),
      (${TENANT}, ${USERS.meister}::uuid, 'kunden'),
      (${TENANT}, ${USERS.meister}::uuid, 'geld'),
      (${TENANT}, ${USERS.werkstatt}::uuid, 'auftraege'),
      (${TENANT}, ${USERS.werkstatt}::uuid, 'kassieren'),
      (${TENANT}, ${USERS.developer}::uuid, 'auftraege'),
      (${TENANT}, ${USERS.developer}::uuid, 'eingang'),
      (${TENANT}, ${USERS.developer}::uuid, 'kunden'),
      (${TENANT}, ${USERS.developer}::uuid, 'geld'),
      (${TENANT}, ${USERS.developer}::uuid, 'einstellungen'),
      (${TENANT}, ${USERS.developer}::uuid, 'logins'),
      (${TENANT}, ${USERS.developer}::uuid, 'wartung')
    ON CONFLICT (tenant_id, user_id, bereich) DO NOTHING
  `;

  const authorization = await authorizationFor("meister");
  const { createCustomerCommand } = await import("@/modules/customers/server-public");
  const customer = await createCustomerCommand(customerContext(authorization), customerInput);
  expect(customer.code).toBe("OK");
  if (customer.code !== "OK") throw new Error(`H11_CUSTOMER_FIXTURE_FAILED:${customer.code}`);
  customerId = customer.receipt.customerId;
});

afterAll(async () => sql.end());

describe("H11 fixed action matrix against real server commands", () => {
  it("matches three stored logins to four concrete server decisions", async () => {
    const { getAuthorizationActionGrants } = await import("@/lib/server/authorization");
    const { confirmPayment } = await import("@/lib/server/commands/confirmPaymentCommand");
    const { changeOrderContent } = await import("@/lib/server/commands/orderContentCommand");
    const { createCustomerCommand } = await import("@/modules/customers/server-public");
    const { createQuoteCommand } = await import("@/modules/quotes/server-public");

    const actions = [
      {
        key: "confirmPayment" as const,
        allowedCode: "NOT_FOUND",
        run: (authorization: Awaited<ReturnType<typeof authorizationFor>>, user: UserKey) => {
          setSession(user);
          return confirmPayment({ invoiceId: INVOICE_ID, amount: 100, method: "bar", expectedVersion: 0, clientEventId: PAYMENT_EVENTS[user] });
        },
      },
      {
        key: "editOrderContent" as const,
        allowedCode: "NOT_FOUND",
        run: (authorization: Awaited<ReturnType<typeof authorizationFor>>, user: UserKey) => {
          setSession(user);
          return changeOrderContent({
            orderId: `h11-missing-${user}`,
            expectedVersion: 1,
            clientEventId: CONTENT_EVENTS[user],
            note: "TEST H11",
            items: [{ id: CONTENT_ITEM_ID, catalogServiceId: null, name: "TEST H11 Teil", quantity: 1, material: null, surface: "TEST H11 Oberfläche", unit: null, unitPriceCents: null, vatRateBasisPoints: null }],
          });
        },
      },
      {
        key: "createCustomer" as const,
        allowedCode: "OK",
        run: (authorization: Awaited<ReturnType<typeof authorizationFor>>) => createCustomerCommand(customerContext(authorization), customerInput),
      },
      {
        key: "createQuote" as const,
        allowedCode: "OK",
        run: (authorization: Awaited<ReturnType<typeof authorizationFor>>) => createQuoteCommand(quoteContext(authorization), {
          clientEventId: QUOTE_EVENT_ID,
          customerId,
          dueDate: "2026-12-15",
          validUntil: "2026-11-30",
          termStatus: "wunsch",
          intakeSource: "anfrage_telefon",
          note: "TEST H11 Aktionsmatrix",
          positions: [{ name: "TEST H11 Position", quantity: 1, material: "Stahl", surfaceRequested: "Zink", unitPriceCents: 1000 }],
        }),
      },
    ];

    let combinations = 0;
    for (const user of ["meister", "werkstatt", "developer"] as const) {
      const authorization = await authorizationFor(user);
      const grants = getAuthorizationActionGrants(authorization);
      for (const action of actions) {
        const result = await action.run(authorization, user);
        expect(result.code, `${user}:${action.key}`).toBe(grants[action.key] ? action.allowedCode : "FORBIDDEN");
        combinations += 1;
      }
    }
    expect(combinations).toBe(12);
  });
});
