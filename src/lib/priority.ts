import { RiskLevel, getRiskConfig, RiskConfig } from "@/constants/status";

export interface PriorityEvaluation {
  risk: RiskLevel;
  config: RiskConfig;
  statusText: string;
  dueLabel: string;
  dueValue: string;
}

export function evaluateOrderPriority(order: {
  dueDate: string | null | undefined; // "YYYY-MM-DD" or similar text
  risk?: RiskLevel | string;
  isBlocked?: boolean;
}): PriorityEvaluation {
  const isBlocked = order.isBlocked || order.risk === "blocked";
  
  if (isBlocked) {
    const config = getRiskConfig("blocked");
    return {
      risk: "blocked",
      config,
      statusText: "WARTET AUF FREIGABE",
      dueLabel: "Wartet auf",
      dueValue: "Freigabe"
    };
  }

  if (typeof order.dueDate !== "string" || !order.dueDate.trim() || Number.isNaN(new Date(order.dueDate).getTime())) {
    const config = getRiskConfig("unknown");
    return { risk: "unknown", config, statusText: "TERMIN NICHT ERFASST", dueLabel: "Termin", dueValue: "Nicht erfasst" };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(order.dueDate);
  
  const diffTime = due.getTime() - now.getTime();
  const diffHours = diffTime / (1000 * 60 * 60);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let risk: RiskLevel = "green";
  let statusText = "IM PLAN";
  let dueLabel = "Fällig in";
  let dueValue = `${diffDays} Tagen`;

  if (diffHours < 0) {
    risk = "red";
    statusText = "KRITISCH / ÜBERFÄLLIG";
    dueLabel = "Überfällig seit";
    dueValue = `${Math.abs(diffDays)} Tagen`;
    if (Math.abs(diffDays) === 1) dueValue = "1 Tag";
  } else if (diffHours < 24) {
    risk = "orange";
    statusText = "GEFÄHRDET";
    dueLabel = "Fällig";
    dueValue = "Heute";
  } else if (diffHours < 72) {
    risk = "yellow";
    statusText = "LEICHT KRITISCH";
    dueLabel = "Fällig in";
    dueValue = `${diffDays} Tagen`;
  } else {
    risk = "green";
    statusText = "IM PLAN";
    dueLabel = "Fällig in";
    dueValue = `${diffDays} Tagen`;
  }

  const config = getRiskConfig(risk);

  return {
    risk,
    config,
    statusText,
    dueLabel,
    dueValue
  };
}
