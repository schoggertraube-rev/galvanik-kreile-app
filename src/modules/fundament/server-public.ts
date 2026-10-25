import "server-only";

export { readSystemSettings, updateCompanySettings, updateManagedUser } from "./server/systemSettingsPort";
export type { SystemSettingsContext } from "./server/systemSettingsPort";
