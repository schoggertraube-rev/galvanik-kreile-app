import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

const { Client } = pg;

const host = process.env.PGHOST ?? "127.0.0.1";
const port = Number(process.env.PGPORT ?? "5432");
const user = process.env.PGUSER ?? "postgres";
const database = process.env.PGDATABASE ?? "";
const validationScope = process.env.KREILE_VALIDATION_SCOPE ?? "all";

if (process.env.KREILE_LOCAL_VALIDATION !== "1") {
  throw new Error("KREILE_LOCAL_VALIDATION=1 is required");
}
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  throw new Error(`Refusing non-loopback PostgreSQL host: ${host}`);
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PostgreSQL port: ${process.env.PGPORT ?? ""}`);
}
if (!/^kreile_payment_concurrency_[a-z0-9_]+$/.test(database)) {
  throw new Error(
    "PGDATABASE must be a disposable kreile_payment_concurrency_* database",
  );
}
if (!["all", "rate-limit"].includes(validationScope)) {
  throw new Error("KREILE_VALIDATION_SCOPE must be all or rate-limit");
}

const connection = {
  host,
  port,
  user,
  database,
  password: process.env.PGPASSWORD,
  ssl: false,
  statement_timeout: 15_000,
  query_timeout: 20_000,
};

const clientA = new Client({
  ...connection,
  application_name: "kreile-payment-concurrency-a",
});
const clientB = new Client({
  ...connection,
  application_name: "kreile-payment-concurrency-b",
});

const runId = randomUUID().replaceAll("-", "");
const tenant = "galvanik-kreile";
const customerId = `validation-concurrency-customer-${runId}`;
const orderIds = {
  reservation: `validation-concurrency-reservation-${runId}`,
  priceFirst: `validation-concurrency-price-first-${runId}`,
  reservationFirst: `validation-concurrency-reservation-first-${runId}`,
  finalize: `validation-concurrency-finalize-${runId}`,
};

function tokenHash(label) {
  return createHash("sha256").update(`${runId}:${label}`, "utf8").digest("hex");
}

async function backendPid(client) {
  const result = await client.query("select pg_backend_pid() as pid");
  return Number(result.rows[0].pid);
}

async function waitUntilBlocked(observer, waiterPid, blockerPid, label) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await observer.query(
      `select $1::integer = any(pg_blocking_pids($2::integer)) as blocked`,
      [blockerPid, waiterPid],
    );
    if (result.rows[0]?.blocked === true) return;
    await delay(25);
  }
  throw new Error(`${label}: expected PostgreSQL lock wait was not observed`);
}

async function quote(client, orderId) {
  const result = await client.query(
    `select *
       from public.get_mollie_payment_quote($1::text, $2::text)`,
    [tenant, orderId],
  );
  assert.equal(result.rowCount, 1, `${orderId}: quote must have one row`);
  return result.rows[0];
}

async function reserve(
  client,
  { attemptId, orderId, amountCents, quoteDigest, tokenHash },
) {
  return client.query(
    `select *
       from public.reserve_mollie_payment_attempt(
         $1::uuid, $2::text, $3::text, $4::bigint, $5::text, $6::text
       )`,
    [attemptId, tenant, orderId, amountCents, quoteDigest, tokenHash],
  );
}

async function createFixtures() {
  await clientA.query(
    `insert into public.customers (id, tenant_id, name, type)
     values ($1, $2, $3, 'business')`,
    [customerId, tenant, `Concurrency ${runId}`],
  );

  for (const [suffix, orderId] of Object.entries(orderIds)) {
    await clientA.query(
      `insert into public.orders (
         id, tenant_id, order_number, customer_id, title, station, status
       ) values ($1, $2, $3, $4, $5, 'wareneingang', 'in_progress')`,
      [
        orderId,
        tenant,
        `CONCURRENCY-${suffix.toUpperCase()}-${runId}`,
        customerId,
        `Concurrency ${suffix}`,
      ],
    );
    await clientA.query(
      `insert into public.price_lines (
         tenant_id, order_id, position_text, qty, unit_price_eur
       ) values ($1, $2, $3, 1, 100)`,
      [tenant, orderId, `Concurrency ${suffix}`],
    );
  }
}

async function verifyReservationRace() {
  const currentQuote = await quote(clientA, orderIds.reservation);
  const attempts = [randomUUID(), randomUUID()];

  await clientA.query("begin");
  await clientB.query("begin");
  try {
    const pending = [
      reserve(clientA, {
        attemptId: attempts[0],
        orderId: orderIds.reservation,
        amountCents: currentQuote.amount_cents,
        quoteDigest: currentQuote.quote_digest,
        tokenHash: tokenHash("reservation-a"),
      }).then((result) => ({ client: clientA, index: 0, result })),
      reserve(clientB, {
        attemptId: attempts[1],
        orderId: orderIds.reservation,
        amountCents: currentQuote.amount_cents,
        quoteDigest: currentQuote.quote_digest,
        tokenHash: tokenHash("reservation-b"),
      }).then((result) => ({ client: clientB, index: 1, result })),
    ];

    const winner = await Promise.race(pending);
    await winner.client.query("commit");
    const loser = await pending[1 - winner.index];
    await loser.client.query("commit");

    const rows = [winner.result.rows[0], loser.result.rows[0]];
    assert.deepEqual(
      rows.map((row) => row.was_created).sort(),
      [false, true],
      "reservation race must create exactly one payment",
    );
    assert.equal(
      rows[0].payment_id,
      rows[1].payment_id,
      "reservation race must converge on one payment id",
    );
  } catch (error) {
    await Promise.allSettled([
      clientA.query("rollback"),
      clientB.query("rollback"),
    ]);
    throw error;
  }

  const receipt = await clientA.query(
    `select count(*)::integer as row_count
       from public.payments
      where tenant_id = $1
        and order_id = $2
        and provider = 'mollie'
        and status in ('creating', 'pending')`,
    [tenant, orderIds.reservation],
  );
  assert.equal(
    receipt.rows[0].row_count,
    1,
    "reservation race left more than one active payment",
  );
}

async function verifyPriceMutationStartsFirst() {
  const originalQuote = await quote(clientA, orderIds.priceFirst);
  const pidA = await backendPid(clientA);
  const pidB = await backendPid(clientB);

  await clientA.query("begin");
  await clientA.query(
    `update public.price_lines
        set unit_price_eur = 110
      where tenant_id = $1 and order_id = $2`,
    [tenant, orderIds.priceFirst],
  );

  const reservation = reserve(clientB, {
    attemptId: randomUUID(),
    orderId: orderIds.priceFirst,
    amountCents: originalQuote.amount_cents,
    quoteDigest: originalQuote.quote_digest,
    tokenHash: tokenHash("price-first"),
  }).then(
    (result) => ({ result }),
    (error) => ({ error }),
  );

  await waitUntilBlocked(
    clientA,
    pidB,
    pidA,
    "price mutation before reservation",
  );
  await clientA.query("commit");

  const outcome = await reservation;
  assert.ok(outcome.error, "stale reservation unexpectedly succeeded");
  assert.match(outcome.error.message, /PAYMENT_QUOTE_CHANGED/);

  const paymentCount = await clientA.query(
    `select count(*)::integer as row_count
       from public.payments
      where tenant_id = $1 and order_id = $2`,
    [tenant, orderIds.priceFirst],
  );
  assert.equal(paymentCount.rows[0].row_count, 0);
  const updatedQuote = await quote(clientA, orderIds.priceFirst);
  assert.equal(updatedQuote.amount_cents, "11000");
}

async function verifyReservationStartsFirst() {
  const currentQuote = await quote(clientA, orderIds.reservationFirst);
  const pidA = await backendPid(clientA);
  const pidB = await backendPid(clientB);

  await clientA.query("begin");
  await reserve(clientA, {
    attemptId: randomUUID(),
    orderId: orderIds.reservationFirst,
    amountCents: currentQuote.amount_cents,
    quoteDigest: currentQuote.quote_digest,
    tokenHash: tokenHash("reservation-first"),
  });

  const priceMutation = clientB
    .query(
      `update public.price_lines
          set unit_price_eur = 120
        where tenant_id = $1 and order_id = $2`,
      [tenant, orderIds.reservationFirst],
    )
    .then(
      (result) => ({ result }),
      (error) => ({ error }),
    );

  await waitUntilBlocked(
    clientA,
    pidB,
    pidA,
    "reservation before price mutation",
  );
  await clientA.query("commit");

  const outcome = await priceMutation;
  assert.ok(outcome.error, "price mutation bypassed the active quote lock");
  assert.match(outcome.error.message, /ACTIVE_PAYMENT_LOCKS_QUOTE/);

  const price = await clientA.query(
    `select unit_price_eur::text as unit_price_eur
       from public.price_lines
      where tenant_id = $1 and order_id = $2`,
    [tenant, orderIds.reservationFirst],
  );
  assert.equal(price.rows[0].unit_price_eur, "100.00");
}

async function verifyParallelFinalize() {
  const currentQuote = await quote(clientA, orderIds.finalize);
  const attemptId = randomUUID();
  const providerIntent = `tr_${runId.slice(0, 48)}`;

  await reserve(clientA, {
    attemptId,
    orderId: orderIds.finalize,
    amountCents: currentQuote.amount_cents,
    quoteDigest: currentQuote.quote_digest,
    tokenHash: tokenHash("finalize"),
  });
  await clientA.query(
    `select public.bind_mollie_payment_provider(
       $1::uuid, $2::text, 'open'::text, $3::bigint, $4::text
     )`,
    [
      attemptId,
      providerIntent,
      currentQuote.amount_cents,
      currentQuote.quote_digest,
    ],
  );

  const sequenceBefore = await clientA.query(
    `select last_value::bigint::text as last_value, is_called
       from public.ausgangsrechnung_nummer_seq`,
  );

  const finalizeSql = `
    select *
      from public.finalize_mollie_payment(
        $1::text,
        'paid'::text,
        'banktransfer'::text,
        '2099-07-15T12:00:00Z'::timestamptz,
        $2::text,
        $3::text,
        $4::bigint,
        $5::text
      )`;
  const parameters = [
    providerIntent,
    orderIds.finalize,
    tenant,
    currentQuote.amount_cents,
    currentQuote.quote_digest,
  ];

  const [first, second] = await Promise.all([
    clientA.query(finalizeSql, parameters),
    clientB.query(finalizeSql, parameters),
  ]);
  const results = [first.rows[0], second.rows[0]];
  assert.deepEqual(
    results.map((row) => row.created).sort(),
    [false, true],
    "parallel finalize must create exactly one invoice",
  );
  assert.equal(
    results[0].invoice_id,
    results[1].invoice_id,
    "parallel finalize must replay the same invoice",
  );

  const receipt = await clientA.query(
    `select
       (select count(*)::integer
          from public.ausgangsrechnung
         where bezahlt_payment_id = $1::uuid) as invoice_count,
       (select count(*)::integer
          from public.events
         where id = $2::text) as event_count,
       (select status
          from public.payments
         where id = $1::uuid) as payment_status`,
    [attemptId, `payment_${attemptId.replaceAll("-", "")}_paid`],
  );
  assert.equal(receipt.rows[0].invoice_count, 1);
  assert.equal(receipt.rows[0].event_count, 1);
  assert.equal(receipt.rows[0].payment_status, "completed");

  const sequenceAfter = await clientA.query(
    `select last_value::bigint::text as last_value, is_called
       from public.ausgangsrechnung_nummer_seq`,
  );
  const before = sequenceBefore.rows[0];
  const after = sequenceAfter.rows[0];
  const expectedLastValue = before.is_called
    ? BigInt(before.last_value) + 1n
    : BigInt(before.last_value);
  assert.equal(after.is_called, true);
  assert.equal(BigInt(after.last_value), expectedLastValue);
}

async function consumePinAttempt(client, subjectHash, limit = 5) {
  return client.query(
    `select *
       from public.consume_security_rate_limit(
         'pin-login'::text, $1::text, $2::integer, 3600::integer
       )`,
    [subjectHash, limit],
  );
}

async function resetPinAttempts(client, subjectHash) {
  return client.query(
    `select public.reset_security_rate_limit(
       'pin-login'::text, $1::text
     ) as reset`,
    [subjectHash],
  );
}

async function pinCounter(client, subjectHash) {
  const result = await client.query(
    `select attempt_count, window_started_at, updated_at
       from public.security_rate_limit_counters
      where namespace = 'pin-login' and subject_hash = $1`,
    [subjectHash],
  );
  assert.equal(result.rowCount, 1, "PIN counter receipt is missing");
  return result.rows[0];
}

async function verifyPinCounterConcurrency() {
  const subjectHash = runId.repeat(2);
  const pidA = await backendPid(clientA);
  const pidB = await backendPid(clientB);

  const initial = await Promise.all([
    consumePinAttempt(clientA, subjectHash),
    consumePinAttempt(clientB, subjectHash),
  ]);
  assert.deepEqual(
    initial.map((result) => result.rows[0].allowed),
    [true, true],
  );
  assert.deepEqual(
    initial.map((result) => Number(result.rows[0].remaining)).sort(),
    [3, 4],
    "parallel PIN attempts did not consume distinct durable slots",
  );
  assert.equal((await pinCounter(clientA, subjectHash)).attempt_count, 2);

  await consumePinAttempt(clientA, subjectHash);
  await consumePinAttempt(clientA, subjectHash);
  await consumePinAttempt(clientA, subjectHash);
  const locked = await Promise.all([
    consumePinAttempt(clientA, subjectHash),
    consumePinAttempt(clientB, subjectHash),
  ]);
  for (const result of locked) {
    assert.equal(result.rows[0].allowed, false);
    assert.equal(Number(result.rows[0].remaining), 0);
    assert.ok(Number(result.rows[0].retry_after_seconds) > 0);
  }
  assert.equal(
    (await pinCounter(clientA, subjectHash)).attempt_count,
    5,
    "denied PIN attempts must not overrun the configured limit",
  );

  await clientA.query("begin");
  await consumePinAttempt(clientA, subjectHash);
  const resetAfterConsume = resetPinAttempts(clientB, subjectHash).then(
    (result) => ({ result }),
    (error) => ({ error }),
  );
  await waitUntilBlocked(
    clientA,
    pidB,
    pidA,
    "PIN consume before successful-login reset",
  );
  await clientA.query("commit");
  const resetOutcome = await resetAfterConsume;
  assert.ifError(resetOutcome.error);
  assert.equal(resetOutcome.result.rows[0].reset, true);
  assert.equal((await pinCounter(clientA, subjectHash)).attempt_count, 0);

  await clientA.query("begin");
  await resetPinAttempts(clientA, subjectHash);
  const consumeAfterReset = consumePinAttempt(clientB, subjectHash).then(
    (result) => ({ result }),
    (error) => ({ error }),
  );
  await waitUntilBlocked(
    clientA,
    pidB,
    pidA,
    "successful-login reset before PIN consume",
  );
  await clientA.query("commit");
  const consumeOutcome = await consumeAfterReset;
  assert.ifError(consumeOutcome.error);
  assert.equal(consumeOutcome.result.rows[0].allowed, true);
  assert.equal(Number(consumeOutcome.result.rows[0].remaining), 4);
  assert.equal((await pinCounter(clientA, subjectHash)).attempt_count, 1);
}

await clientA.connect();
await clientB.connect();
try {
  if (validationScope === "all") {
    await createFixtures();
    await verifyReservationRace();
    await verifyPriceMutationStartsFirst();
    await verifyReservationStartsFirst();
    await verifyParallelFinalize();
  }
  await verifyPinCounterConcurrency();
  process.stdout.write(`${validationScope === "all" ? "payment_pin" : "rate_limit"}_concurrency_ok\n`);
} finally {
  await Promise.allSettled([clientA.end(), clientB.end()]);
}
