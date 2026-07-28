import { test } from "vitest";

/**
 * Capture is intentionally fail-closed. A future test must run only in the
 * approved isolated lab and prove upload/OCR receipt, tenant ownership and
 * retry behavior; it must never create records in a product-like target.
 */
test.skip("scan-to-order integration awaits the approved capture receipt contract", () => {});
