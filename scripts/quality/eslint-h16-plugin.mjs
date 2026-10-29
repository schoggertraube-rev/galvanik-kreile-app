function sourceTextRule(pattern, message) {
  return {
    meta: {
      type: "problem",
      docs: { description: message },
      schema: [],
      messages: { violation: message },
    },
    create(context) {
      return {
        Program(node) {
          if (pattern.test(context.sourceCode.text)) {
            context.report({ node, messageId: "violation" });
          }
        },
      };
    },
  };
}

export default {
  rules: {
    "no-silent-error": sourceTextRule(
      /catch\s*\{\s*\}|\.catch\s*\(\s*\(\s*\)\s*=>\s*(?:null|\[\])\s*\)/s,
      "Fehler dürfen nicht still verworfen werden; protokolliere einen stabilen Code und liefere einen sichtbaren Fehlerpfad.",
    ),
    "no-alert": sourceTextRule(
      /\balert\s*\(/,
      "alert() ist kein kontrollierter Fehlerpfad; zeige die Meldung im App-Zustand.",
    ),
    "no-placeholder-text": sourceTextRule(
      /\bWIP\b|\bDemo\b|\bmock\b/,
      "Produktcode darf keine WIP-, Demo- oder mock-Kennzeichnung enthalten.",
    ),
    "no-tenant-literal": sourceTextRule(
      /["']galvanik-kreile["']/,
      "Das Tenant-Literal darf nur aus dem zentralen Tenant-Vertrag kommen.",
    ),
  },
};
