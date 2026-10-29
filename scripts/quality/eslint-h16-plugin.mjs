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
    "no-role-identity-comparison": sourceTextRule(
      /\b(?:[A-Za-z_$][\w$]*\.)?role\s*(?:===|!==)/,
      "Rollenidentität darf keine Rechteentscheidung treffen; nutze Bereiche oder Berechtigungen.",
    ),
    "no-role-permissions": sourceTextRule(
      /\bROLE_PERMISSIONS\b/,
      "ROLE_PERMISSIONS ist eine zweite Rechtewahrheit und darf nicht verwendet werden.",
    ),
    "no-person-names": sourceTextRule(
      /\b(?:Rolf|Phillip|Gregor)\b/,
      "Personennamen gehören nicht in Produktcode; nutze die Datenbankidentität oder Rollenbezeichnung.",
    ),
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
