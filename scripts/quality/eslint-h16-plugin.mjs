const PERSON_NAME_PATTERN = /\b(?:Rolf|Phillip|Gregor)\b/u;
const ROLE_PERMISSIONS_PATTERN = /\bROLE_PERMISSIONS\b/u;
const PLACEHOLDER_TEXT_PATTERN = /\b(?:WIP|Demo|mock)\b/iu;

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

function isMemberNamed(node, name) {
  if (node?.type !== "MemberExpression") return false;
  if (!node.computed && node.property.type === "Identifier") {
    return node.property.name === name;
  }
  return node.computed
    && node.property.type === "Literal"
    && node.property.value === name;
}

function isEmptyCatchFallback(node) {
  if (node?.type !== "CallExpression" || !isMemberNamed(node.callee, "catch")) return false;
  const handler = node.arguments[0];
  if (handler?.type !== "ArrowFunctionExpression" && handler?.type !== "FunctionExpression") {
    return false;
  }
  return (handler.body.type === "Literal" && handler.body.value === null)
    || (handler.body.type === "ArrayExpression" && handler.body.elements.length === 0);
}

function staticText(node) {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateElement") return node.value.cooked ?? node.value.raw;
  if (node?.type === "JSXText") return node.value;
  return null;
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
    "no-silent-errors": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          emptyCatch: "Leerer catch-Block ist verboten; Fehler sichtbar behandeln.",
          emptyFallback: "Stiller catch-Fallback auf null oder [] ist verboten; Fehler sichtbar behandeln.",
        },
      },
      create(context) {
        return {
          CatchClause(node) {
            if (node.body.body.length === 0) {
              context.report({ node, messageId: "emptyCatch" });
            }
          },
          CallExpression(node) {
            if (isEmptyCatchFallback(node)) {
              context.report({ node, messageId: "emptyFallback" });
            }
          },
        };
      },
    },
    "no-alert": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          forbidden: "alert() ist verboten; eine sichtbare, nicht blockierende Fehlermeldung verwenden.",
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (
              (node.callee.type === "Identifier" && node.callee.name === "alert")
              || isMemberNamed(node.callee, "alert")
            ) {
              context.report({ node, messageId: "forbidden" });
            }
          },
        };
      },
    },
    "no-placeholder-text": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          forbidden: "WIP-, Demo- oder Mock-Text ist im Produktcode verboten.",
        },
      },
      create(context) {
        function check(node) {
          const value = staticText(node);
          if (value !== null && PLACEHOLDER_TEXT_PATTERN.test(value)) {
            context.report({ node, messageId: "forbidden" });
          }
        }
        return {
          Literal: check,
          TemplateElement: check,
          JSXText: check,
        };
      },
    },
  },
};

export default plugin;
