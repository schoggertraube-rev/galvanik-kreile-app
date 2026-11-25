export {TASK_KINDS,TASK_KIND_LABELS,taskValidation} from './contract';
export {TaskDialogs} from './ui/TaskDialogs';
export type {TaskPorts} from './ui/TaskDialog';
export type {TaskKind,TaskReferenceType,TaskReference,TaskSaveInput,TaskCompleteInput,TaskRecord,TaskReferenceRead,TaskFailure,TaskResult,TaskReadResult,TaskOpenRequest} from './contract';

export type {TaskCalendarRead} from './contract';
/** Qualified by the caller while the lager article is locked in the same transaction. */
export type LagerBestandFuerAufgabe = Readonly<{artikelId:string;artikelName:string;negativ:boolean;heute:string}>;
