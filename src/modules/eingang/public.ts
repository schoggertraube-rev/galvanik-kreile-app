export type {TaskPorts} from '@/modules/tasks/public';
export {IntakeMessages} from './ui/IntakeMessages';
export type {IntakeMessagesPorts} from './messageContract';
export type {AssignmentPorts} from './assignmentContract';
export {
  GLOBAL_CREATE_OPEN_EVENT,
  requestGlobalCreate,
} from "./requestGlobalCreate";
export {INTAKE_MAIL_ADOPT_EVENT} from './mailSelectionContract';
export type {IntakeMailSummary,IntakeMailSelectionResult} from './mailSelectionContract';
export {IntakeMessageDialogs} from './ui/IntakeMessageDialogs';
export type {MailSelectionPorts} from './ui/MailSelectionDialog';
export type { IntakeCapture, IntakeCaptureResult, IntakeNoteInput, IntakeNoteReading, IntakeContext, IntakeConcern, IntakeCaptureKindInput } from "./captureContract";
export { uploadIntakeOriginal } from "./intakeOriginalUpload";
export type {
  GlobalCreateIntent,
  GlobalCreateRequest,
} from "./requestGlobalCreate";
export { GlobalCreateFlow } from "./GlobalCreateFlow";
export {
  ORDER_INTAKE_FREE_TEXT_UNITS,
  isOrderIntakeFreeTextUnit,
  ORDER_POSITION_UNITS,
  ORDER_POSITION_SURFACES,
  normaliseOrderPositionUnit,
  normaliseOrderPositionSurface,
  orderPositionUnitLabel,
  orderPositionSurfaceLabel,
  orderPositionQuantityError,
  orderPositionPriceError,
  orderPositionEffortError,
} from "@/lib/orderPositionContract";
export type { OrderIntakeFreeTextUnit, OrderPositionUnit, OrderPositionSurface } from "@/lib/orderPositionContract";
export { findRecognizedCustomers } from "./customerRecognition";
export type { RecognizedCustomerSuggestions } from "./customerRecognition";
export { TelefonnotizLayoutBoundary } from "./ui/TelefonnotizLayoutBoundary";
export type { TelefonnotizLayoutBoundaryProps } from "./ui/TelefonnotizLayoutBoundary";
export type {
  DirectIntakeInput,
  ConvertQuoteInput,
  CreateQuoteInput,
  GlobalCreateConversionResult,
  GlobalCreateCustomerResult,
  GlobalCreateCustomerChoice,
  GlobalCreateDirectIntakeResult,
  GlobalCreateOpenQuotesResult,
  GlobalCreatePorts,
  GlobalCreateQuoteReadResult,
  GlobalCreateQuoteResult,
  UpdateQuoteInput,
} from "./GlobalCreateFlow";

export type {CustomerComparisonValue} from "@/modules/customers/public";
export { getIntakeDeviceId, type IntakeDeviceCommand, type IntakeDeviceRequest, type IntakeDeviceResult } from "./deviceContract";
export { IntakeDirectEntry } from "./ui/IntakeDirectEntry";
export { IntakeDraftList } from "./ui/IntakeDraftList";
export {parseGoodsReceiptInput,parseQuoteGoodsReceiptInput,goodsReceiptGaps,goodsReceiptWare} from "./goodsReceiptContract";
export type {GoodsReceiptInput,GoodsReceiptPhotoKind,GoodsReceiptOrderRead,GoodsReceiptRecord,GoodsReceiptFailure,GoodsReceiptReadResult} from "./goodsReceiptContract";
export {IntakeObjectDialogs} from "./ui/IntakeObjectDialogs";
export type {IntakeObjectPorts} from "./ui/IntakeObjectDialogs";
export type {OriginalReadResult,OriginalConfirmResult} from "./originalContract";
export type { IntakeDraft, IntakeDraftPorts, IntakeDraftResult } from "./draftContract";
export type {IntakeProspectInput,IntakeProspectResult} from './prospectContract';
export {invoiceCents,invoiceDate,invoiceFieldErrors,invoiceWarnings,EMPTY_INVOICE_FIELDS} from './invoiceContract';
export type {InvoicePorts,InvoiceFields,InvoiceView,InvoiceResult,InvoiceReadResult,InvoiceSupplier,InvoiceChangeInput,InvoiceSaveInput} from './invoiceContract';
export {IncomingInvoiceDialogs} from './ui/IncomingInvoiceDialogs';

export {ComplaintDialogs,type ComplaintPorts} from '@/modules/complaints/public';

export {hasQuoteFinancials} from '@/modules/quotes/public';
