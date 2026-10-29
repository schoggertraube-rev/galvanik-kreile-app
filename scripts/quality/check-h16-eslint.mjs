import { ESLint, Linter } from "eslint";
import h16Plugin from "./eslint-h16-plugin.mjs";

const H16_RULES = {
  "h16/no-role-identity-comparison": "error",
  "h16/no-role-permissions": "error",
  "h16/no-person-names": "error",
  "h16/no-silent-error": "error",
  "h16/no-alert": "error",
  "h16/no-placeholder-text": "error",
  "h16/no-tenant-literal": "error",
};

function runSelftest() {
  const linter = new Linter({ configType: "flat" });
  const cases = [
    ["const denied = session.role === 'developer';", "h16/no-role-identity-comparison"],
    ["const ROLE_PERMISSIONS = {};", "h16/no-role-permissions"],
    ["const displayName = 'Rolf';", "h16/no-person-names"],
    ["fetchValue().catch(() => null);", "h16/no-silent-error"],
    ["alert('Fehler');", "h16/no-alert"],
    ["const label = 'Demo';", "h16/no-placeholder-text"],
    ["const tenant = 'galvanik-kreile';", "h16/no-tenant-literal"],
  ];

  for (const [source, expectedRule] of cases) {
    const messages = linter.verify(source, [{
      files: ["**/*.ts"],
      languageOptions: { ecmaVersion: "latest", sourceType: "module" },
      plugins: { h16: h16Plugin },
      rules: H16_RULES,
    }], { filename: "src/__tests__/h16-deliberate-violation.test.ts" });
    if (!messages.some((message) => message.ruleId === expectedRule && message.severity === 2)) {
      throw new Error(`H16_SELFTEST_DID_NOT_REJECT:${expectedRule}`);
    }
  }
  console.log("H16_ESLINT_SELFTEST=PASS");
}

async function runGate() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(["src/**/*.{ts,tsx}"]);
  const violations = results.flatMap((result) => result.messages
    .filter((message) => message.ruleId?.startsWith("h16/"))
    .map((message) => `${result.filePath}:${message.line}:${message.column} ${message.ruleId} ${message.message}`));
  if (violations.length > 0) {
    console.error(violations.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log("H16_ESLINT_CONTRACTS=PASS");
}

if (process.argv.includes("--selftest")) {
  runSelftest();
} else {
  await runGate();
}
