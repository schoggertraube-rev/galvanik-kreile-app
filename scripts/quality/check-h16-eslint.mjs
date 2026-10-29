import process from "node:process";
import { ESLint, Linter } from "eslint";
import h16Plugin from "./eslint-h16-plugin.mjs";

const RULES = {
  "h16/no-role-identity-comparison": "error",
  "h16/no-role-permissions": "error",
  "h16/no-person-names": "error",
};

function verifySample(source) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(source, [{
    plugins: { h16: h16Plugin },
    rules: RULES,
  }]);
}

function selftest() {
  const violations = [
    'const denied = role === "developer";',
    'const denied = new Set(["developer"]).has(role);',
    'const denied = new Set(ROLE_PERMISSIONS);',
    'const denied = "Rolf";',
  ];
  for (const source of violations) {
    const messages = verifySample(source).filter((message) => message.ruleId?.startsWith("h16/"));
    if (messages.length !== 1) {
      throw new Error(`H16_SELFTEST_EXPECTED_REJECTION: ${source}`);
    }
  }

  const allowed = [
    "// eslint-disable-next-line h16/no-role-identity-comparison -- erlaubt H11c",
    'const allowed = role === "developer";',
  ].join("\n");
  const allowedMessages = verifySample(allowed).filter((message) => message.ruleId?.startsWith("h16/"));
  if (allowedMessages.length !== 0) {
    throw new Error("H16_SELFTEST_DOCUMENTED_EXCEPTION_REJECTED");
  }
  process.stdout.write("H16_ESLINT_SELFTEST=PASS\n");
}

async function checkRepository() {
  const eslint = new ESLint({ cwd: process.cwd() });
  const results = await eslint.lintFiles(["src/**/*.{ts,tsx}"]);
  const violations = results.flatMap((result) => result.messages
    .filter((message) => message.ruleId?.startsWith("h16/"))
    .map((message) => `${result.filePath}:${message.line}:${message.column} ${message.ruleId} ${message.message}`));
  if (violations.length > 0) {
    process.stderr.write(`${violations.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("H16_ESLINT_CONTRACTS=PASS\n");
}

if (process.argv.includes("--selftest")) {
  selftest();
} else {
  await checkRepository();
}
