import type {CaseActorTrace} from "@/lib/domain/caseActorContract";
import { normaliseIban, validIban } from '@/modules/customers/public';
import type {IntakeFileInput,IntakeFileGrant,IntakeCaptureResult} from './captureContract';

export const INVOICE_STATUSES = ['offen', 'bezahlt', 'unklar', 'doppelt', 'ungueltig'] as const;
export type IncomingInvoiceStatus = typeof INVOICE_STATUSES[number];
export type InvoiceFields = {
  lieferantId: string; nummer: string; datum: string;
  netto: string; ust: string; brutto: string; faelligAm: string;
  iban: string; ibanGeprueft: boolean;
};
export const EMPTY_INVOICE_FIELDS: InvoiceFields = {
  lieferantId: '', nummer: '', datum: '', netto: '', ust: '', brutto: '',
  faelligAm: '', iban: '', ibanGeprueft: false,
};
export type InvoiceSupplier = {
  id: string; name: string; iban: string | null; paymentTermDays: number | null;
};
export type IncomingInvoice = {
  id: string; nummer_intern: string; item_id: string; file_id: string;
  lieferant_id: string | null; nummer: string | null; datum: string | null;
  netto: string | null; ust: string | null; brutto: string | null;
  faellig_am: string | null; iban: string | null; iban_geprueft: boolean;
  zahlstatus: IncomingInvoiceStatus; bezahlt_am: string | null;
  nachweis_file_id: string | null; verweis_id: string | null;
  dublette_grund: string | null; unklar_grund: string | null;
  aufgabe_id: string | null; ungueltig_grund: string | null;
  erfasst_von: string; erfasst_am: string; version: number;
};
export type InvoiceOriginal = { id: string; name: string; mime: string; sha256: string };
export type InvoiceDuplicate = {
  id: string; number: string | null; internalNumber: string;
  date: string | null; gross: string | null; exact: boolean;
};
export type InvoiceView = {
 actorTrace?:CaseActorTrace;
  item: { id: string; version: number; at: string; channel: string; sender: string | null };
  invoice: IncomingInvoice | null; supplier: InvoiceSupplier | null;
  originals: InvoiceOriginal[]; fileId: string | null; fields: InvoiceFields;
  uncertain: number; conflict: string | null; duplicate: InvoiceDuplicate | null;
};
export type InvoiceFailure = {
  code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT' | 'UNAVAILABLE';
  message: string; fields?: Record<string, string>;
};
export type InvoiceReadResult = { code: 'OK'; view: InvoiceView } | InvoiceFailure;
export type InvoiceSaveInput = {
  itemId: string; fileId: string; version: number; clientKey: string;
  fields: InvoiceFields; status: Exclude<IncomingInvoiceStatus, 'ungueltig'>;
  paidDate: string | null; proofFileId: string | null;
  duplicateId: string | null; duplicateReason: string | null; unclearReason: string | null;
};
export type InvoiceChangeInput = {
  invoiceId: string; version: number; clientKey: string;
  result: Exclude<IncomingInvoiceStatus, 'unklar'>;
  paidDate: string | null; proofFileId: string | null;
  duplicateId: string | null; reason: string | null; fields: InvoiceFields | null;
};
export type InvoiceResult = {
  code: 'OK'; invoice: IncomingInvoice; replayed: boolean;
} | { code: 'DUPLICATE'; message: string; duplicate: InvoiceDuplicate } | InvoiceFailure;
export type InvoicePorts = {
  read: (request: { id: string }) => Promise<InvoiceReadResult>;
  save: (input: InvoiceSaveInput) => Promise<InvoiceResult>;
  status: (input: InvoiceChangeInput) => Promise<InvoiceResult>;
  clarify: (input: InvoiceChangeInput) => Promise<InvoiceResult>;
  searchSuppliers: (query: string) => Promise<{ code: 'OK'; suppliers: InvoiceSupplier[] } | InvoiceFailure>;
  openOriginal: (itemId: string, fileId: string) => void;
  createSupplier: (itemId: string) => Promise<{ code: 'OK' } | InvoiceFailure>;
  prepareFile: (input:IntakeFileInput) => Promise<IntakeFileGrant>;
  finishFile: (fileId:string) => Promise<IntakeCaptureResult>;
  openTask: (taskId: string) => void;
};

/** Decimal input is converted once to integer cents, shared by client and server. */
export function invoiceCents(raw: string): number | null {
  const value = raw.trim().replace(/\s/g, '');
  const grouped = /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value);
  if (!grouped && !/^[+-]?\d+(?:[,.]\d{1,2})?$/.test(value)) return null;
  const normalized = (grouped ? value.replace(/\./g, '') : value).replace(',', '.');
  const sign = normalized.startsWith('-') ? -1 : 1;
  const [whole, fraction = ''] = normalized.replace(/^[+-]/, '').split('.');
  const cents = sign * (Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
  return Number.isSafeInteger(cents) && Math.abs(cents) <= 99_999_999_999_999 ? cents : null;
}
export function invoiceDecimal(cents: number): string {
  const magnitude = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.trunc(magnitude / 100)}.${String(magnitude % 100).padStart(2, '0')}`;
}
export function invoiceDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T12:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function invoiceFieldErrors(value: InvoiceFields, partial = false): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!partial && !value.lieferantId.trim()) errors.lieferantId = 'Lieferant fehlt';
  if (!partial && !value.nummer.trim()) errors.nummer = 'Rechnungsnummer fehlt';
  if (value.nummer.length > 255 || /[\u0000-\u001f]/.test(value.nummer)) errors.nummer = 'Rechnungsnummer ist ungültig';
  for (const key of ['datum', 'faelligAm'] as const) {
    if (!value[key] && !partial) errors[key] = key === 'datum' ? 'Rechnungsdatum fehlt' : 'Fällig am fehlt';
    else if (value[key] && !invoiceDate(value[key])) errors[key] = 'Datum ist ungültig';
  }
  for (const key of ['netto', 'ust', 'brutto'] as const) {
    if (!value[key].trim() && partial) continue;
    if (invoiceCents(value[key]) === null) errors[key] = value[key].trim() ? 'Betrag ist ungültig' : 'Betrag fehlt';
  }
  if (value.iban.trim() && !validIban(value.iban)) errors.iban = 'IBAN ungültig';
  return errors;
}
export function invoiceFieldShape(value: unknown): value is InvoiceFields {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const fields = value as Record<string, unknown>;
  const strings = ['lieferantId', 'nummer', 'datum', 'netto', 'ust', 'brutto', 'faelligAm', 'iban'];
  return Object.keys(fields).sort().join(',') === [...strings, 'ibanGeprueft'].sort().join(',')
    && strings.every(key => typeof fields[key] === 'string' && fields[key].length <= 255)
    && typeof fields.ibanGeprueft === 'boolean';
}
export function invoiceWarnings(value: InvoiceFields, supplier: InvoiceSupplier | null): string[] {
  const warnings: string[] = [];
  const net = invoiceCents(value.netto), tax = invoiceCents(value.ust), gross = invoiceCents(value.brutto);
  if (net !== null && tax !== null && gross !== null && Math.abs(net + tax - gross) > 2) {
    warnings.push('Netto + USt weicht vom Brutto ab · am Original prüfen');
  }
  if (supplier?.iban && value.iban.trim() && normaliseIban(value.iban) !== normaliseIban(supplier.iban)) {
    warnings.push('IBAN anders als bisher – vor Zahlung telefonisch prüfen');
  }
  return warnings;
}
