import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

try {
  execSync("npx vitest run src/test/scan_order.integration.test.ts", {
    stdio: "inherit",
    env: { ...process.env }
  });
} catch (e) {
  process.exit(1);
}
