/**
 * Production Order Visibility Contract
 *
 * Central predicate that determines whether a DB row is a legitimate
 * production order for the galvanik-kreile tenant.
 *
 * Rules (all must pass):
 *  1. tenantId must be "galvanik-kreile"
 *  2. source must NOT be: seed | test | demo | integration-test | e2e
 *  3. source must be one of: manual, scan, customer (source null is NOT visible)
 *  4. orderNumber must be present and must NOT match A-SEED-* or *TEST* (case-insensitive)
 *  5. customerId must be present
 *  6. title or task must be present
 *  7. title/task must not be gibberish or obvious test text
 */

/** Keyword sources that are never production-safe */
const BLOCKED_SOURCES = new Set([
  "seed",
  "test",
  "demo",
  "integration-test",
  "e2e",
]);

/** Lower-cased substrings that flag a field value as non-production */
const DEMO_TEST_KEYWORDS = [
  "test",
  "e2e",
  "demo",
  "seed",
  "mock",
  "fixture",
  "sample",
  "placeholder",
];

export interface ProductionOrderVisibilityInput {
  tenantId: string | null | undefined;
  source: string | null | undefined;
  orderNumber: string | null | undefined;
  title: string | null | undefined;
  task: string | null | undefined;
  customerId?: string | null | undefined;
}

function isGibberishOrTestText(text: string | null | undefined): boolean {
  if (!text) return false;
  const val = text.trim().toLowerCase();
  if (val.length === 0) return false;

  // 1. Very short title/task
  if (val.length < 3) return true;

  // 2. Obviously senseless title/task or keyboard slide patterns
  const gibberishPatterns = [
    /^[bcdfghjklmnpqrstvwxyz]{5,}/i, // 5 or more consecutive consonants
    /asd|sdf|dfg|fgh|ghj|hjk|jkl|yxc|xcv|cvb|vbn|bnm/i, // keyboard slide
    /^([a-z])\1+$/i, // repeating single character
  ];
  if (gibberishPatterns.some((p) => p.test(val))) return true;

  // 3. Concrete remote test samples from audit
  const exactGibberish = ["gjgvvh", "sfdghgjklji"];
  if (exactGibberish.includes(val)) return true;

  const testPatterns = [
    "auftrag per scan test e2e",
    "test order",
    "test stoßstange kundenakte",
  ];
  if (testPatterns.some((pat) => val.includes(pat))) return true;

  return false;
}

/**
 * Returns true when the row is a production-safe order that should be
 * visible on /orders.
 */
export function isProductionOrderVisible(
  input: ProductionOrderVisibilityInput
): boolean {
  // 1. Tenant guard
  if (input.tenantId !== "galvanik-kreile") return false;

  // 2. Source guards
  if (input.source == null) return false; // source null is NOT visible.
  
  const lowerSource = input.source.toLowerCase();
  if (BLOCKED_SOURCES.has(lowerSource)) return false;

  const VALID_SOURCES = new Set(["manual", "scan", "customer"]);
  if (!VALID_SOURCES.has(lowerSource)) return false;

  // 3. customerId must be present
  if (!input.customerId || input.customerId.trim() === "") return false;

  // 4. orderNumber pattern guards
  const orderNum = (input.orderNumber ?? "").trim();
  if (!orderNum) return false;
  if (/^A-SEED-/i.test(orderNum)) return false;
  if (/TEST/i.test(orderNum)) return false;

  // 5. title/task presence
  const title = (input.title ?? "").trim();
  const task = (input.task ?? "").trim();
  if (!title && !task) return false;

  // 6. title/task must not be gibberish or obvious test text
  if (isGibberishOrTestText(title) || isGibberishOrTestText(task)) return false;

  // 7. kühlergrill 300sl, kronleuchter, Stoßstange rekord c conditional check
  const lowerTitle = title.toLowerCase();
  const lowerTask = task.toLowerCase();
  const conditionalItems = [
    "kühlergrill 300sl",
    "kronleuchter",
    "stoßstange rekord c"
  ];
  const containsConditional = (text: string) => {
    return conditionalItems.some((item) => text.includes(item));
  };
  if (containsConditional(lowerTitle) || containsConditional(lowerTask)) {
    if (!input.customerId || !input.source) {
      return false;
    }
  }

  // 8. Text-field keyword scan (orderNumber, title, task)
  const fieldsToScan = [orderNum, title, task];
  for (const field of fieldsToScan) {
    const lower = field.toLowerCase();
    for (const kw of DEMO_TEST_KEYWORDS) {
      if (lower.includes(kw)) return false;
    }
  }

  // All checks passed → visible
  return true;
}

