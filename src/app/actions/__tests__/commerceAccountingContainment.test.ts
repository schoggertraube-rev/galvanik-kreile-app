import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ports = {
  createClient: vi.fn(),
  checkAppAuth: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({ createClient: ports.createClient }));
vi.mock('@/lib/server/authHelper', () => ({ checkAppAuth: ports.checkAppAuth }));
vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/db/schema_buchhaltung', () => ({ ausgangsrechnung: {}, beleg: {}, kostenposten: {}, kategorie: {} }));
vi.mock('drizzle-orm', () => ({ and: vi.fn(), gte: vi.fn(), lte: vi.fn(), ne: vi.fn(), sql: vi.fn() }));

const denial = 'NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.';
const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function expectNoPortCalls() {
  expect(ports.createClient).not.toHaveBeenCalled();
  expect(ports.checkAppAuth).not.toHaveBeenCalled();
}

describe('Commerce, accounting, shipment, and dunning containment (F0-W2C-B2M2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('denies all eleven commands before authentication or any client access', async () => {
    const [shipment, mahnung, accounting] = await Promise.all([
      import('@/features/orders/shipment.actions'),
      import('../mahnung.actions'),
      import('@/app/buchhaltung/actions'),
    ]);
    const formData = new FormData();

    await expect(shipment.saveShipmentInfo({ orderId: 'order-1', carrier: 'dhl', trackingNumber: 'tracking-1' })).resolves.toEqual({ success: false, error: denial });
    await expect(shipment.sendShippingConfirmation({ orderId: 'order-1', carrier: 'dhl', trackingNumber: 'tracking-1' })).resolves.toEqual({ success: false, error: denial });
    await expect(mahnung.sendeZahlungserinnerung('invoice-1')).resolves.toEqual({ success: false, error: denial });
    await expect(mahnung.sendeMahnung('invoice-1')).resolves.toEqual({ success: false, error: denial });
    await expect(accounting.createBelegAction(formData)).rejects.toThrow(denial);
    await expect(accounting.freigebenBelegAction('beleg-1')).rejects.toThrow(denial);
    await expect(accounting.stornoBelegAction('beleg-1', 'Grund')).rejects.toThrow(denial);
    await expect(accounting.assignBelegeBatchAction(['beleg-1'], { kontoId: 'konto-1' })).rejects.toThrow(denial);
    await expect(accounting.exportBelegeAction('CSV')).rejects.toThrow(denial);
    await expect(accounting.createRechnungAction(formData, [])).rejects.toThrow(denial);
    await expect(accounting.createKostenpostenAction(formData)).rejects.toThrow(denial);

    expectNoPortCalls();
  });
});

describe('Commerce and accounting structural containment (F0-W2C-B2M2)', () => {
  const deniedBodies = [
    ['features/orders/shipment.actions.ts', 'saveShipmentInfo'],
    ['features/orders/shipment.actions.ts', 'sendShippingConfirmation'],
    ['app/actions/mahnung.actions.ts', 'sendeZahlungserinnerung'],
    ['app/actions/mahnung.actions.ts', 'sendeMahnung'],
    ['app/buchhaltung/actions.ts', 'createBelegAction'],
    ['app/buchhaltung/actions.ts', 'freigebenBelegAction'],
    ['app/buchhaltung/actions.ts', 'stornoBelegAction'],
    ['app/buchhaltung/actions.ts', 'assignBelegeBatchAction'],
    ['app/buchhaltung/actions.ts', 'exportBelegeAction'],
    ['app/buchhaltung/actions.ts', 'createRechnungAction'],
    ['app/buchhaltung/actions.ts', 'createKostenpostenAction'],
  ] as const;

  it('keeps each denied body immediate and free of legacy ports', async () => {
    for (const [file, name] of deniedBodies) {
      const source = await readFile(path.join(srcRoot, file), 'utf8');
      const body = source.match(new RegExp(`export async function ${name}[\\s\\S]*?\\)\\s*(?::\\s*Promise<[\\s\\S]*?>)?\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'))?.[1];
      expect(body, `${file}:${name}`).toBeDefined();
      expect(body).toContain(denial);
      expect(body).not.toMatch(/createClient|checkAppAuth|formData\.get|\.from\(|\.storage|\.insert\(|\.update\(|revalidate|communication|event|clipboard/);
    }
  });

  it('quarantines the six noninteractive views and page', async () => {
    const files = [
      'components/orders/variants/VersandVariant.tsx',
      'app/buchhaltung/belege/BelegeClient.tsx',
      'app/buchhaltung/belege/[id]/BelegDetailClient.tsx',
      'app/buchhaltung/rechnungen/neu/RechnungForm.tsx',
      'app/buchhaltung/kosten/neu/KostenForm.tsx',
      'app/buchhaltung/export/page.tsx',
    ];
    for (const file of files) {
      const source = await readFile(path.join(srcRoot, file), 'utf8');
      expect(source).toContain('FoundationUnavailable');
      expect(source).not.toMatch(/actions|OfflineManager|enqueue|<form\b|<button\b|<input\b|useRouter|fetch\(/i);
    }
  });

  it('renders accounting receipt routes as prop-free quarantined clients', async () => {
    const parentFiles = [
      'app/buchhaltung/belege/page.tsx',
      'app/buchhaltung/belege/[id]/page.tsx',
    ];
    for (const file of parentFiles) {
      const source = await readFile(path.join(srcRoot, file), 'utf8');
      expect(source).toContain('dynamic = "force-dynamic"');
      expect(source).toContain('revalidate = 0');
      expect(source).not.toMatch(/getBuchhaltungProvider|actions|searchParams|params|initialBelege|initialBeleg|BelegFilter|BelegDetail\s*\b/);
    }

    const belegePage = await readFile(path.join(srcRoot, parentFiles[0]), 'utf8');
    const detailPage = await readFile(path.join(srcRoot, parentFiles[1]), 'utf8');
    expect(belegePage).toMatch(/return <BelegeClient\s*\/>/);
    expect(detailPage).toMatch(/return <BelegDetailClient\s*\/>/);

    const clientFiles = [
      'app/buchhaltung/belege/BelegeClient.tsx',
      'app/buchhaltung/belege/[id]/BelegDetailClient.tsx',
    ];
    for (const file of clientFiles) {
      const source = await readFile(path.join(srcRoot, file), 'utf8');
      expect(source).toContain('FoundationUnavailable');
      expect(source).not.toMatch(/import\s+type|interface\s+\w*Props|initialBelege|initialBeleg|\{\s*(?:id|initial)/);
    }
  });

  it('keeps Aging reads and phone notes while disabling only dunning controls', async () => {
    const source = await readFile(path.join(srcRoot, 'app/cockpit/components/AgingKachel.tsx'), 'utf8');
    expect(source).toMatch(/getAgingDaten|getAgingRechnungen|savePhoneNote/);
    expect(source).not.toMatch(/sendeZahlungserinnerung|sendeMahnung|navigator\.clipboard|actionStatus|Kopiert/);
    expect(source).not.toContain('Keine bisherige Kommunikation dokumentiert');
    expect(source).toContain('Kommunikationsstatus nicht verfügbar.');
    expect(source).toMatch(/>NOT_AVAILABLE — Mahnwesen bis W3 nicht verfügbar<|NOT_AVAILABLE — Mahnwesen bis W3 nicht verfügbar/);
    expect(source).toMatch(/Zahlungserinnerung[\s\S]{0,300}disabled[\s\S]{0,300}NOT_AVAILABLE|disabled[\s\S]{0,300}NOT_AVAILABLE[\s\S]{0,300}Zahlungserinnerung/);
    expect(source).toMatch(/Mahnung[\s\S]{0,300}disabled[\s\S]{0,300}NOT_AVAILABLE|disabled[\s\S]{0,300}NOT_AVAILABLE[\s\S]{0,300}Mahnung/);
  });

  it('removes every fabricated shipment literal', async () => {
    const source = await readFile(path.join(srcRoot, 'components/orders/variants/VersandVariant.tsx'), 'utf8');
    expect(source).not.toMatch(/Anschrift 1|12345 Stadt|2 Kolli|12,4 kg|14,90|Versicherung/);
  });
});
