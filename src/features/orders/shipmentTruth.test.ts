import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('atomic handover truth boundary', () => {
  it('authenticates before parsing and never accepts tenant or actor authority from input', () => {
    const action = source('src/features/orders/shipment.actions.ts');
    expect(action.indexOf('await resolveAuthorization()')).toBeGreaterThan(-1);
    expect(action.indexOf('parseCompleteHandoverInput(value)')).toBeGreaterThan(action.indexOf('await resolveAuthorization()'));
    expect(action).toContain("permissions.includes('perm_op_status')");
    expect(action).toContain("const TENANT_ID = 'galvanik-kreile'");
    expect(action).not.toMatch(/input\.(tenant|tenantId|actor|userId)/);
  });

  it('locks, validates the terminal route and writes order, event and audit atomically', () => {
    const action = source('src/features/orders/shipment.actions.ts');
    const transactionStart = action.indexOf('db.transaction');
    const transaction = action.slice(transactionStart, action.indexOf('invalidateOperationalOrdersCache', transactionStart));
    expect(transaction).toContain(".for('update')");
    expect(transaction).toContain("getHomogeneousTerminalRoute(orderItems, 'warenausgang')");
    expect(transaction).toContain("status !== 'in_progress'");
    expect(transaction).toContain("status: 'shipped'");
    expect(transaction).toContain('completedDate: new Date(confirmedAt)');
    expect(transaction).toContain('clientEventId: input.clientRequestId');
    expect(transaction).toContain('requestHash: hash');
    expect(transaction).toContain("action: 'order_handover_completed'");
    expect(transaction.indexOf('tx.update(orders)')).toBeLessThan(transaction.indexOf('tx.insert(events)'));
    expect(transaction.indexOf('tx.insert(events)')).toBeLessThan(transaction.indexOf('tx.insert(auditLog)'));
  });

  it('replays only the exact actor, order, hash and evidence without provider side effects', () => {
    const action = source('src/features/orders/shipment.actions.ts');
    expect(action).toContain('return replayReceipt(existing, authorization.data.userId, input, hash)');
    expect(action).toContain("throw new Error('REQUEST_CONFLICT')");
    expect(action).not.toContain('createClient');
    expect(action).not.toContain('communication_messages');
    expect(action).not.toContain("status: 'sent'");
    expect(action).not.toContain('fetch(');
  });

  it('uses the active receipt UI with a stable retry id and no delivery claim', () => {
    const activeOverlay = source('src/components/orders/OrderOverlay.tsx');
    const ui = source('src/components/orders/variants/HandoverVariant.tsx');
    expect(activeOverlay).toContain('import { HandoverVariant }');
    expect(activeOverlay).toContain('storedStatus === "in_progress"');
    expect(activeOverlay).toContain('<HandoverVariant');
    expect(activeOverlay).toContain('canCompleteHandover');
    expect(ui).toContain("useRef<string | null>(null)");
    expect(ui).toContain('if (!requestId.current) requestId.current = crypto.randomUUID()');
    expect(ui).toContain('completeOrderHandover');
    expect(ui).toContain('finally');
    expect(ui).toContain('disabled={submitting}');
    expect(ui).toContain('Carrier-Buchung, Labeldruck und Kundenmail sind nicht automatisch angebunden');
    expect(ui).not.toContain('Versandmail senden');
  });
});
