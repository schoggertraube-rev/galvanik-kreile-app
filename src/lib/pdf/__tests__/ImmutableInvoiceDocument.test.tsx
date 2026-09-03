// @vitest-environment node

import { createHash } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createImmutableInvoiceCancellationPdfDocument,
  createImmutableInvoicePdfDocument,
  type ImmutableInvoiceLine,
  type ImmutableInvoiceSnapshot,
} from "../ImmutableInvoiceDocument";

/**
 * F1.4 — real content evidence for the immutable invoice and cancellation
 * documents.
 *
 * The bytes under test are produced by the unmocked production renderer and
 * are the exact bytes that are parsed again: no fixture, no React tree
 * inspection and no `Buffer.includes` shortcut is accepted as content proof.
 * Every mandatory value is read back from the parsed text layer of those same
 * bytes.
 *
 * Amounts are never proven by their digits alone and never by a single global
 * euro glyph: each amount is bound to its own business label or business row
 * *and* to its own euro sign, in reading order.
 *
 * pdfjs-dist is a test-only dependency. The product runtime never imports it.
 */

const CANCEL_REASON = "Doppelte Berechnung wurde storniert";
const ORIGINAL_INVOICE_NUMBER = "R-2026-0042";
const REDUCED_INVOICE_NUMBER = "R-2026-0143";
/**
 * The Berlin invoice day of ISSUED_AT is 22.08.2026; 30 days payment term is
 * due on 21.09.2026 (August has 31 days: 22.08. + 9 days = 31.08., + 21 days
 * = 21.09.).
 */
const DUE_DATE = "2026-09-21";
/** 2026-08-21T22:30Z is 2026-08-22 in Europe/Berlin: the printed day proves the zone. */
const ISSUED_AT = "2026-08-21T22:30:00.000Z";
/** 2026-08-31T22:15Z is 2026-09-01 in Europe/Berlin. */
const CANCELLED_AT = "2026-08-31T22:15:00.000Z";
const SERVICE_DATE = "2026-08-19";

/**
 * Summer proves CEST (UTC+2). This winter instant proves CET (UTC+1): the
 * Berlin day of 2026-12-31T23:30Z is 01.01.2027, which also crosses the year
 * boundary. 01.01.2027 + 30 days is 31.01.2027.
 */
const WINTER_ISSUED_AT = "2026-12-31T23:30:00.000Z";
const WINTER_DUE_DATE = "2027-01-31";
const WINTER_SERVICE_DATE = "2026-12-30";
const WINTER_INVOICE_NUMBER = "R-2027-0001";

/**
 * Seller and customer country are distinct sentinels, so that neither country
 * can be proven by the other party's address block.
 */
const SELLER_COUNTRY = "Verkaeuferland Sellonia";
const CUSTOMER_COUNTRY = "Kundenland Kundonia";

const SELLER: ImmutableInvoiceSnapshot["seller"] = {
  companyName: "F14 Test Galvanik GmbH",
  street: "Galvanikweg 12",
  zip: "70173",
  city: "Stuttgart",
  country: SELLER_COUNTRY,
  taxId: "DE811234567",
  iban: "DE02120300000000202051",
  bic: "BYLADEM1001",
  bankName: "F14 Testbank",
};

const CUSTOMER: ImmutableInvoiceSnapshot["customer"] = {
  name: "F14 Test Kunde",
  companyName: null,
  contactPerson: null,
  street: "Kundenweg 34",
  zip: "70174",
  city: "Esslingen",
  country: CUSTOMER_COUNTRY,
};

const ORDER: ImmutableInvoiceSnapshot["order"] = {
  orderId: "f14-pdf-order",
  orderVersion: 4,
  orderNumber: "A-2026-0815",
  title: "Verzinkung Rahmenserie",
  freezeId: "14141414-1414-4141-8141-141414141499",
};

const LINES: ImmutableInvoiceLine[] = [
  {
    type: "BASE",
    itemId: "f14-pdf-item-1",
    name: "Zinkbeschichtung Charge 42",
    quantity: 3,
    unitNetAmountCents: 40000,
    lineNetAmountCents: 120000,
  },
  {
    type: "EXTRA_WORK",
    itemId: "f14-pdf-item-1",
    catalogPositionId: "14141414-1414-4141-8141-141414141498",
    catalogPositionName: "Zusatzarbeit Entgratung",
    minutes: 90,
    hourlyRateCents: 12000,
    amountCents: 18000,
  },
];

const NET_AMOUNT_CENTS = 138000;

function snapshotFor(vatRateBasisPoints: 700 | 1900): ImmutableInvoiceSnapshot {
  const vatAmountCents = Math.round((NET_AMOUNT_CENTS * vatRateBasisPoints) / 10000);
  return {
    schemaVersion: 1,
    seller: SELLER,
    customer: CUSTOMER,
    order: ORDER,
    lines: LINES,
    totals: {
      netAmountCents: NET_AMOUNT_CENTS,
      vatRateBasisPoints,
      vatAmountCents,
      grossAmountCents: NET_AMOUNT_CENTS + vatAmountCents,
    },
    serviceDate: SERVICE_DATE,
    issuedAt: ISSUED_AT,
    paymentTermDays: 30,
  };
}

type LoadingTask = ReturnType<typeof getDocument>;
type PdfDocument = Awaited<LoadingTask["promise"]>;

type PdfEvidence = {
  bytes: Buffer;
  sha256: string;
  pageCount: number;
  /** `PDFDocumentProxy.hasJSActions()` — must be exactly `false`. */
  hasJsActions: boolean;
  /** `PDFDocumentProxy.getJSActions()` — must be `null` or empty. */
  documentJsActions: object | null;
  /** `PDFPageProxy.getJSActions()` per actually read page — `null` or empty. */
  pageJsActions: (object | null)[];
  /** Whitespace-collapsed text of every page, in reading order. */
  spacedText: string;
  /** Whitespace-free text, so proof does not depend on inter-run spacing. */
  compactText: string;
};

/**
 * Canonicalises every kind of Unicode whitespace (including the no-break
 * spaces the de-DE currency format emits) to a single ASCII space.
 */
function canonicalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function compactOf(value: string): string {
  return value.replace(/\s+/g, "");
}

async function readPdfEvidence(bytes: Buffer): Promise<PdfEvidence> {
  const loadingTask = getDocument({
    data: Uint8Array.from(bytes),
    stopAtErrors: true,
    enableXfa: false,
  });
  let pdfDocument: PdfDocument | null = null;
  try {
    pdfDocument = await loadingTask.promise;
    const hasJsActions = await pdfDocument.hasJSActions();
    const documentJsActions = await pdfDocument.getJSActions();
    const pageCount = pdfDocument.numPages;
    const pageJsActions: (object | null)[] = [];
    const fragments: string[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      try {
        pageJsActions.push(await page.getJSActions());
        const textContent = await page.getTextContent();
        for (const item of textContent.items) {
          if ("str" in item) fragments.push(item.str);
        }
      } finally {
        page.cleanup();
      }
    }
    const spacedText = canonicalizeWhitespace(fragments.join(" "));
    return {
      bytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      pageCount,
      hasJsActions,
      documentJsActions,
      pageJsActions,
      spacedText,
      compactText: compactOf(spacedText),
    };
  } finally {
    // `PDFDocumentProxy` has no `destroy()` in pdfjs-dist 6.2.108; `cleanup()`
    // is the document-level release. Even if it throws, the loading task is
    // destroyed exactly once, so no worker/transport is leaked.
    try {
      if (pdfDocument) await pdfDocument.cleanup();
    } finally {
      await loadingTask.destroy();
    }
  }
}

const CORE_VARIANTS = [
  "original-19",
  "cancellation-19",
  "original-7",
  "cancellation-7",
] as const;

/** The winter/CET document is additional evidence, not a replacement. */
const VARIANTS = [...CORE_VARIANTS, "original-19-winter"] as const;
type Variant = (typeof VARIANTS)[number];

const evidence = new Map<Variant, PdfEvidence>();

function evidenceFor(variant: Variant): PdfEvidence {
  const entry = evidence.get(variant);
  if (!entry) throw new Error(`F1_4_PDF_EVIDENCE_MISSING:${variant}`);
  return entry;
}

type ContentBinding = {
  /** Business meaning of the binding, reported when it does not hold. */
  label: string;
  /** Values that must appear in this order, bound to one another. */
  parts: readonly string[];
  /**
   * Maximum number of characters tolerated between two parts. `0` (default)
   * demands one uninterrupted phrase. A gap is only used where the production
   * document itself prints separator glyphs between the bound values.
   */
  maxGap?: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bindingPattern({ parts, maxGap = 0 }: ContentBinding): RegExp {
  const separator = maxGap === 0 ? "" : `[^]{0,${maxGap}}`;
  return new RegExp(parts.map((part) => escapeRegExp(compactOf(part))).join(separator));
}

/**
 * Text is painted in element-tree order, so the parsed text layer preserves
 * reading order. Comparing on whitespace-free text makes the binding immune to
 * inter-run spacing, while still refusing values that only appear somewhere
 * else in the document.
 */
function expectBindings(compactText: string, bindings: readonly ContentBinding[]): void {
  const unbound = bindings
    .filter((binding) => !bindingPattern(binding).test(compactText))
    .map((binding) => binding.label);
  expect(unbound).toEqual([]);
}

/** de-DE currency output, e.g. `1.380,00 €`. Whitespace is normalised away. */
function eur(amount: string): string {
  return `${amount} €`;
}

/** Every `N %` token in the document, in reading order. */
function vatRateTokens(spacedText: string): string[] {
  return [...spacedText.matchAll(/(\d+(?:,\d+)?) ?%/g)].map((match) => match[1]);
}

function expectNoJsActions(actions: object | null): void {
  if (actions === null) return;
  expect(Object.keys(actions)).toEqual([]);
}

/** Bindings that must hold on every original invoice, at any VAT rate. */
const ORIGINAL_COMMON_BINDINGS: readonly ContentBinding[] = [
  {
    label: "seller address block incl. its own country and tax id",
    parts: [
      "F14 Test Galvanik GmbH",
      "Galvanikweg 12",
      "70173 Stuttgart",
      SELLER_COUNTRY,
      "USt-IdNr.: DE811234567",
    ],
  },
  {
    label: "customer address block incl. its own country",
    parts: ["F14 Test Kunde", "Kundenweg 34", "70174 Esslingen", CUSTOMER_COUNTRY],
  },
  // Invoice date is the Berlin day of the UTC issue instant.
  { label: "invoice date (Berlin day of the issue instant)", parts: ["Rechnungsdatum: 22.08.2026"] },
  // Service date is lexical, never re-derived from an instant.
  { label: "service date", parts: ["Leistungsdatum: 19.08.2026"] },
  { label: "order number", parts: ["Auftragsnummer: A-2026-0815"] },
  { label: "order title", parts: ["Auftrag: Verzinkung Rahmenserie"] },
  {
    label: "base line row: description, quantity, unit net €, line net €",
    parts: ["Zinkbeschichtung Charge 42", "3 Stk.", eur("400,00"), eur("1.200,00")],
  },
  {
    label: "extra-work line row: description, minutes, hourly rate €, line net €",
    parts: ["Zusatzarbeit Entgratung", "90 Min.", `${eur("120,00")}/Std.`, eur("180,00")],
  },
  { label: "net total bound to its label and €", parts: ["Netto", eur("1.380,00")] },
  {
    // The footer prints `bankName · IBAN … · BIC …`, hence the separator gap.
    label: "bank details in the footer",
    parts: ["F14 Testbank", "IBAN DE02120300000000202051", "BIC BYLADEM1001"],
    maxGap: 3,
  },
];

/** Bindings that must hold on every cancellation document, at any VAT rate. */
const CANCELLATION_COMMON_BINDINGS: readonly ContentBinding[] = [
  {
    label: "seller address block incl. its own country and tax id",
    parts: [
      "F14 Test Galvanik GmbH",
      "Galvanikweg 12",
      "70173 Stuttgart",
      SELLER_COUNTRY,
      "USt-IdNr.: DE811234567",
    ],
  },
  {
    label: "customer address block incl. its own country",
    parts: ["F14 Test Kunde", "Kundenweg 34", "70174 Esslingen", CUSTOMER_COUNTRY],
  },
  // Cancellation date is the Berlin day of the UTC cancellation instant.
  { label: "cancellation date (Berlin day of the cancellation instant)", parts: ["Stornodatum: 01.09.2026"] },
  { label: "service date", parts: ["Leistungsdatum: 19.08.2026"] },
  { label: "order number", parts: ["Auftragsnummer: A-2026-0815"] },
  { label: "order title", parts: ["Auftrag: Verzinkung Rahmenserie"] },
  { label: "cancellation reason", parts: [`Stornogrund: ${CANCEL_REASON}`] },
  {
    label: "base line row: description, quantity, negative unit net €, negative line net €",
    parts: ["Zinkbeschichtung Charge 42", "3 Stk.", eur("-400,00"), eur("-1.200,00")],
  },
  {
    label: "extra-work line row: description, minutes, negative rate €, negative line net €",
    parts: ["Zusatzarbeit Entgratung", "90 Min.", eur("-120,00"), eur("-180,00")],
  },
  {
    label: "negative net total bound to its label and €",
    parts: ["Storno netto", eur("-1.380,00")],
  },
];

beforeAll(async () => {
  const documents: Record<Variant, Parameters<typeof renderToBuffer>[0]> = {
    "original-19": createImmutableInvoicePdfDocument({
      invoiceNumber: ORIGINAL_INVOICE_NUMBER,
      dueDate: DUE_DATE,
      snapshot: snapshotFor(1900),
    }),
    "cancellation-19": createImmutableInvoiceCancellationPdfDocument({
      invoiceNumber: ORIGINAL_INVOICE_NUMBER,
      cancelledAt: CANCELLED_AT,
      cancelReason: CANCEL_REASON,
      snapshot: snapshotFor(1900),
    }),
    "original-7": createImmutableInvoicePdfDocument({
      invoiceNumber: REDUCED_INVOICE_NUMBER,
      dueDate: DUE_DATE,
      snapshot: snapshotFor(700),
    }),
    "cancellation-7": createImmutableInvoiceCancellationPdfDocument({
      invoiceNumber: REDUCED_INVOICE_NUMBER,
      cancelledAt: CANCELLED_AT,
      cancelReason: CANCEL_REASON,
      snapshot: snapshotFor(700),
    }),
    "original-19-winter": createImmutableInvoicePdfDocument({
      invoiceNumber: WINTER_INVOICE_NUMBER,
      dueDate: WINTER_DUE_DATE,
      snapshot: {
        ...snapshotFor(1900),
        issuedAt: WINTER_ISSUED_AT,
        serviceDate: WINTER_SERVICE_DATE,
      },
    }),
  };

  for (const variant of VARIANTS) {
    // Unmocked production renderer; exactly these bytes are parsed below.
    const bytes = await renderToBuffer(documents[variant]);
    evidence.set(variant, await readPdfEvidence(bytes));
  }
}, 180_000);

describe("immutable invoice PDF bytes", () => {
  it.each(VARIANTS)("%s is a loadable PDF of a sane size", (variant) => {
    const pdf = evidenceFor(variant);

    expect(pdf.bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.bytes.subarray(-2048).toString("latin1")).toContain("%%EOF");
    expect(pdf.bytes.byteLength).toBeGreaterThan(1024);
    expect(pdf.bytes.byteLength).toBeLessThan(2 * 1024 * 1024);
    expect(pdf.pageCount).toBeGreaterThanOrEqual(1);
    expect(pdf.compactText.length).toBeGreaterThan(400);
  });

  it.each(VARIANTS)("%s carries no document- or page-level JavaScript", (variant) => {
    const pdf = evidenceFor(variant);

    // No document-level or field-level JavaScript may exist in an accounting document.
    expect(pdf.hasJsActions).toBe(false);
    expectNoJsActions(pdf.documentJsActions);
    expect(pdf.pageJsActions).toHaveLength(pdf.pageCount);
    for (const pageActions of pdf.pageJsActions) expectNoJsActions(pageActions);
  });

  it.each(VARIANTS)("%s carries the euro currency glyph in the parsed text layer", (variant) => {
    expect(evidenceFor(variant).spacedText).toContain("€");
  });
});

describe("original invoice content, read back from the rendered bytes", () => {
  it("proves every mandatory value at 19 % VAT", () => {
    const { compactText } = evidenceFor("original-19");

    expectBindings(compactText, [
      ...ORIGINAL_COMMON_BINDINGS,
      { label: "invoice number", parts: [`Rechnungsnummer: ${ORIGINAL_INVOICE_NUMBER}`] },
      { label: "VAT amount bound to the 19 % rate label and €", parts: ["zzgl. USt (19 %)", eur("262,20")] },
      { label: "gross amount bound to its label and €", parts: ["Rechnungsbetrag brutto", eur("1.642,20")] },
      {
        // `fällig am ` sits between the term and the due date.
        label: "payment term bound to the Berlin due date",
        parts: ["Zahlungsziel: 30 Tage netto,", "21.09.2026"],
        maxGap: 16,
      },
    ]);
    expect(compactText).not.toContain("Stornobeleg");
  });

  it("proves every mandatory value at 7 % VAT", () => {
    const { compactText } = evidenceFor("original-7");

    expectBindings(compactText, [
      ...ORIGINAL_COMMON_BINDINGS,
      { label: "invoice number", parts: [`Rechnungsnummer: ${REDUCED_INVOICE_NUMBER}`] },
      { label: "VAT amount bound to the 7 % rate label and €", parts: ["zzgl. USt (7 %)", eur("96,60")] },
      { label: "gross amount bound to its label and €", parts: ["Rechnungsbetrag brutto", eur("1.476,60")] },
      {
        label: "payment term bound to the Berlin due date",
        parts: ["Zahlungsziel: 30 Tage netto,", "21.09.2026"],
        maxGap: 16,
      },
    ]);
    expect(compactText).not.toContain("Stornobeleg");
  });
});

describe("cancellation document content, read back from the rendered bytes", () => {
  it("proves original reference, reason, Berlin cancellation day and negative amounts at 19 % VAT", () => {
    const { compactText } = evidenceFor("cancellation-19");

    expectBindings(compactText, [
      ...CANCELLATION_COMMON_BINDINGS,
      // Reference to the unchanged original.
      { label: "cancellation title bound to the original invoice number", parts: ["Stornobeleg", `Zu Rechnung: ${ORIGINAL_INVOICE_NUMBER}`] },
      { label: "cancellation notice names the original invoice", parts: [`Die Rechnung ${ORIGINAL_INVOICE_NUMBER} wurde`] },
      { label: "negative VAT bound to the 19 % rate label and €", parts: ["Storno USt (19 %)", eur("-262,20")] },
      { label: "negative gross bound to its label and €", parts: ["Stornobetrag brutto", eur("-1.642,20")] },
    ]);
    // A cancellation document never claims a payment.
    expect(compactText).not.toContain("Zahlungsziel");
  });

  it("proves original reference, reason, Berlin cancellation day and negative amounts at 7 % VAT", () => {
    const { compactText } = evidenceFor("cancellation-7");

    expectBindings(compactText, [
      ...CANCELLATION_COMMON_BINDINGS,
      { label: "cancellation title bound to the original invoice number", parts: ["Stornobeleg", `Zu Rechnung: ${REDUCED_INVOICE_NUMBER}`] },
      { label: "cancellation notice names the original invoice", parts: [`Die Rechnung ${REDUCED_INVOICE_NUMBER} wurde`] },
      { label: "negative VAT bound to the 7 % rate label and €", parts: ["Storno USt (7 %)", eur("-96,60")] },
      { label: "negative gross bound to its label and €", parts: ["Stornobetrag brutto", eur("-1.476,60")] },
    ]);
    expect(compactText).not.toContain("Zahlungsziel");
  });
});

describe("VAT rates are mutually exclusive per document", () => {
  const expectations = [
    { variant: "original-19", printed: "19", forbidden: "7" },
    { variant: "cancellation-19", printed: "19", forbidden: "7" },
    { variant: "original-7", printed: "7", forbidden: "19" },
    { variant: "cancellation-7", printed: "7", forbidden: "19" },
  ] as const;

  it.each(expectations)(
    "$variant prints only the $printed percent rate and never the $forbidden percent rate",
    ({ variant, printed, forbidden }) => {
      const pdf = evidenceFor(variant);
      const rates = vatRateTokens(pdf.spacedText);

      // Exactly one VAT rate exists in the whole document, and it is the right one.
      expect(rates.length).toBeGreaterThan(0);
      expect([...new Set(rates)]).toEqual([printed]);
      expect(rates).not.toContain(forbidden);
      expect(pdf.compactText).not.toContain(`USt(${forbidden}%)`);
    },
  );
});

describe("original and cancellation are distinct documents", () => {
  it("differs in bytes and hash per variant and per VAT rate", () => {
    const original19 = evidenceFor("original-19");
    const cancellation19 = evidenceFor("cancellation-19");
    const original7 = evidenceFor("original-7");
    const cancellation7 = evidenceFor("cancellation-7");

    expect(original19.bytes.equals(cancellation19.bytes)).toBe(false);
    expect(original7.bytes.equals(cancellation7.bytes)).toBe(false);
    expect(original19.bytes.equals(original7.bytes)).toBe(false);

    const hashes = [
      original19.sha256,
      cancellation19.sha256,
      original7.sha256,
      cancellation7.sha256,
    ];
    expect(hashes.every((hash) => /^[a-f0-9]{64}$/.test(hash))).toBe(true);
    expect(new Set(hashes).size).toBe(4);
  });
});

describe("Berlin calendar truth across the CET year boundary", () => {
  it("prints 01.01.2027 and a 31.01.2027 due date for a 2026-12-31T23:30Z issue instant", () => {
    const { compactText } = evidenceFor("original-19-winter");

    expectBindings(compactText, [
      { label: "winter invoice number", parts: [`Rechnungsnummer: ${WINTER_INVOICE_NUMBER}`] },
      // 23:30Z on 31.12. is already 00:30 on 01.01. in CET (UTC+1).
      { label: "CET invoice date crosses into the next year", parts: ["Rechnungsdatum: 01.01.2027"] },
      { label: "service date stays the lexical calendar day", parts: ["Leistungsdatum: 30.12.2026"] },
      {
        label: "payment term bound to the CET due date 30 days later",
        parts: ["Zahlungsziel: 30 Tage netto,", "31.01.2027"],
        maxGap: 16,
      },
      { label: "net total bound to its label and €", parts: ["Netto", eur("1.380,00")] },
      { label: "VAT amount bound to the 19 % rate label and €", parts: ["zzgl. USt (19 %)", eur("262,20")] },
      { label: "gross amount bound to its label and €", parts: ["Rechnungsbetrag brutto", eur("1.642,20")] },
    ]);
    // The UTC day 31.12.2026 must never reach the document.
    expect(compactText).not.toContain("Rechnungsdatum:31.12.2026");
  });
});

describe("fail-closed date formatting", () => {
  it("refuses an unusable issue instant, service date or due date instead of printing a fallback", async () => {
    const base = snapshotFor(1900);

    await expect(renderToBuffer(createImmutableInvoicePdfDocument({
      invoiceNumber: ORIGINAL_INVOICE_NUMBER,
      dueDate: DUE_DATE,
      snapshot: { ...base, issuedAt: "2026-08-21" },
    }))).rejects.toThrow();

    await expect(renderToBuffer(createImmutableInvoicePdfDocument({
      invoiceNumber: ORIGINAL_INVOICE_NUMBER,
      dueDate: DUE_DATE,
      snapshot: { ...base, serviceDate: "2026-02-30" },
    }))).rejects.toThrow();

    await expect(renderToBuffer(createImmutableInvoicePdfDocument({
      invoiceNumber: ORIGINAL_INVOICE_NUMBER,
      dueDate: "21.09.2026",
      snapshot: base,
    }))).rejects.toThrow();

    await expect(renderToBuffer(createImmutableInvoiceCancellationPdfDocument({
      invoiceNumber: ORIGINAL_INVOICE_NUMBER,
      cancelledAt: "2026-08-31T22:15:00Z",
      cancelReason: CANCEL_REASON,
      snapshot: base,
    }))).rejects.toThrow();
  }, 60_000);
});
