import "server-only";
export {selectIntakeConcern,finishIntakeUse,reopenIntake} from './server/intakeLifecycle';
export {saveIntakeProspect} from './server/intakeProspect';
export {readOpenIntakeMails} from "./server/intakeMailRead";
export { readIntakeDrafts, writeIntakeDraft, discardIntakeDraft } from "./server/intakeDraft";

export { saveIntakeNote, readIntakeCapture, readIntakeNoteText, readIntakePendingScope, discardIntakeCapture } from "./server/intakeCapture";
export { prepareIntakeFile, finishIntakeFile, retryIntakeRecognition } from "./server/intakeFile";

export { erfasseAuftragAusEingangCommand, type EingangCustomerPreflight } from "./server/erfasseAuftragAusEingangCommand";
export type {
  ErfasseAuftragInput,
  ErfasseAuftragResult,
} from "./types";

export { readIntakeFileChanges, type IntakeFileChange } from "./server/intakeLive";
export { processIntakeDeviceRequest } from "./server/intakeDevice";
