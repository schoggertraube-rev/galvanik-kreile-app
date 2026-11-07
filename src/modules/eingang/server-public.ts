import "server-only";
export {readIncomingInvoice,saveIncomingInvoice,changeIncomingInvoice,readInvoiceTaskContext} from './server/incomingInvoice';
export type {InvoiceDependencies} from './server/incomingInvoice';
export {readIntakeMessages} from './server/intakeMessages';
export {readIntakeAssignment,assignIntakeCustomer,setIntakeNoBusiness,createCustomerForIntake} from './server/intakeAssignment';
export {selectIntakeConcern,finishIntakeUse,reopenIntake} from './server/intakeLifecycle';
export {recordIntakeTaskEffect} from './server/intakeTaskEffect';
export {saveIntakeProspect} from './server/intakeProspect';
export {readOpenIntakeMails} from "./server/intakeMailRead";
export {openIntakeOriginal,confirmIntakeOriginal,readOrderIntakeOriginals} from "./server/intakeOriginal";
export { saveGoodsReceipt,readGoodsReceipts,createGoodsReceiptStationBinding,writeCreatedOrderGoodsReceipt } from "./server/goodsReceipt";
export type { GoodsReceiptResult,GoodsReceiptDependencies } from "./server/goodsReceipt";
export { readIntakeDrafts, writeIntakeDraft, discardIntakeDraft, createIntakeContinuation } from "./server/intakeDraft";

export { saveIntakeNote, readIntakeCapture, readIntakeNoteText, readIntakePendingScope, discardIntakeCapture, chooseIntakeCaptureKind } from "./server/intakeCapture";
export { prepareIntakeFile, finishIntakeFile, retryIntakeRecognition } from "./server/intakeFile";

export { erfasseAuftragAusEingangCommand, type EingangCustomerPreflight } from "./server/erfasseAuftragAusEingangCommand";
export type {
  ErfasseAuftragInput,
  ErfasseAuftragResult,
} from "./types";

export { readIntakeFileChanges, type IntakeFileChange } from "./server/intakeLive";
export { processIntakeDeviceRequest } from "./server/intakeDevice";
