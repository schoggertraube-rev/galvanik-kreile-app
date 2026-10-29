const PERSON_NAME_PATTERN = /\b(?:Rolf|Phillip|Gregor)\b/u;
const ROLE_PERMISSIONS_PATTERN = /\bROLE_PERMISSIONS\b/u;

function isRoleReference(node) {
  if (!node) return false;
  if (node.type === "Identifier") return node.name === "role";
  if (node.type !== "MemberExpression") return false;
  if (!node.computed && node.property.type === "Identifier") {
    return node.property.name === "role";
  }
  return node.computed
    && node.property.type === "Literal"
    && node.property.value === "role";
}

function isMembershipCheck(node) {
  if (node.type !== "CallExpression" || node.arguments.length === 0) return false;
  if (!node.arguments.some((argument) => argument.type !== "SpreadElement" && isRoleReference(argument))) {
    return false;
  }
  if (node.callee.type !== "MemberExpression") return false;
  if (!node.callee.computed && node.callee.property.type === "Identifier") {
    return node.callee.property.name === "has" || node.callee.property.name === "includes";
  }
  return node.callee.computed
    && node.callee.property.type === "Literal"
    && (node.callee.property.value === "has" || node.callee.property.value === "includes");
}

function sourceRule(pattern, messageId) {
  return {
    meta: {
      type: "problem",
      schema: [],
      messages: { [messageId]: messageId },
    },
    create(context) {
      return {
        Program(node) {
          if (pattern.test(context.sourceCode.text)) {
            context.report({ node, messageId });
          }
        },
      };
    },
  };
}

const plugin = {
  meta: { name: "eslint-plugin-h16", version: "1.0.0" },
  rules: {
    "no-role-identity-comparison": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          forbidden: "Rollenvergleich durch Bereichsprüfung ersetzen oder als erlaubte H11c-Stelle dokumentieren.",
        },
      },
      create(context) {
        return {
          BinaryExpression(node) {
            if (
              (node.operator === "===" || node.operator === "!==")
              && (isRoleReference(node.left) || isRoleReference(node.right))
            ) {
              context.report({ node, messageId: "forbidden" });
            }
          },
          CallExpression(node) {
            if (isMembershipCheck(node)) {
              context.report({ node, messageId: "forbidden" });
            }
          },
        };
      },
    },
    "no-role-permissions": sourceRule(
      ROLE_PERMISSIONS_PATTERN,
      "ROLE_PERMISSIONS ist als zweite Rechtewahrheit verboten.",
    ),
    "no-person-names": sourceRule(
      PERSON_NAME_PATTERN,
      "Personenname im Produktcode verboten; Anzeigenamen aus app_users.full_name verwenden.",
    ),
  },
};

export default plugin;
