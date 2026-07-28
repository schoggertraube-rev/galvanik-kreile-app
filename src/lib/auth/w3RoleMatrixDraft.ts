/**
 * W3-ROLE-MATRIX-001 is a policy draft only. It is deliberately not imported
 * by runtime authorization, routes, server actions, or database code.
 * A later approved migration must implement these predicates server-side and
 * prove them with tenant and assignment negative tests before activation.
 */
export const W3_DRAFT_ROLES = [
  "anon",
  "werkstatt",
  "buero",
  "meister",
  "admin",
  "readonly",
  "developer",
  "finance",
  "marketing",
  "consent",
  "export",
  "kommunikation",
  "telemetrie",
  "photo_ocr_ai",
] as const;

export type W3DraftRole = (typeof W3_DRAFT_ROLES)[number];
export type W3DraftResource =
  | "work_item"
  | "customer"
  | "order"
  | "manual_goods_receipt"
  | "handoff"
  | "qa_decision"
  | "blocker_decision"
  | "priority"
  | "process_configuration"
  | "integration_configuration"
  | "roles"
  | "finance"
  | "price"
  | "contact"
  | "export"
  | "telemetry"
  | "photo_ocr_ai"
  | "batch";

export type W3DraftAction = "read" | "start" | "pause" | "complete" | "create" | "update" | "manage";

export type W3DraftRequest = {
  roles: readonly W3DraftRole[];
  sameTenant: boolean;
  explicitlyAssignedWorkItem: boolean;
  resource: W3DraftResource;
  action: W3DraftAction;
};

const WORKSHOP_ACTIONS: readonly W3DraftAction[] = ["start", "pause", "complete", "update"];

/** Default deny. Role presence alone never grants cross-tenant or unassigned access. */
export function isW3DraftAllowed(request: W3DraftRequest): boolean {
  if (!request.sameTenant || request.roles.includes("anon")) return false;

  if (request.resource === "finance" || request.resource === "price" || request.resource === "export" || request.resource === "telemetry" || request.resource === "photo_ocr_ai" || request.resource === "batch") {
    return false;
  }

  if (request.roles.includes("werkstatt")) {
    return request.resource === "work_item"
      && request.explicitlyAssignedWorkItem
      && WORKSHOP_ACTIONS.includes(request.action);
  }

  if (request.roles.includes("meister")) {
    return (request.resource === "qa_decision" || request.resource === "blocker_decision" || request.resource === "priority")
      && (request.action === "read" || request.action === "update");
  }

  if (request.roles.includes("buero")) {
    return (request.resource === "customer" || request.resource === "order" || request.resource === "manual_goods_receipt" || request.resource === "handoff")
      && (request.action === "read" || request.action === "create" || request.action === "update");
  }

  if (request.roles.includes("admin")) {
    return (request.resource === "roles" || request.resource === "process_configuration" || request.resource === "integration_configuration")
      && (request.action === "read" || request.action === "manage");
  }

  return false;
}
