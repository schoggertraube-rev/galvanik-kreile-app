const fs = require('fs');

try {
    let content = fs.readFileSync('src/lib/mockCustomersExtended.ts', 'utf8');

    const enrichments = {
      'Museum Lenzburg': `
    companyInfo: { industry: 'Kultur & Museen', size: '10-50 Mitarbeiter', website: 'museum-lenzburg.ch', founded: '1905' },
    aiSummary: 'Das Museum Lenzburg ist eine der wichtigsten Kulturinstitutionen im Aargau. Höchste Anforderungen an Restaurierungsqualität. Budget für authentische Materialien ist vorhanden.',
    tags: ['VIP', 'Museumsqualität', 'Restauration'],
    creditRating: 'AAA (Öffentliche Hand)',`,
      'Atelier Schmid': `
    companyInfo: { industry: 'Kunsthandwerk & Design', size: '1-5 Mitarbeiter', website: 'atelier-schmid-design.ch', founded: '2012', linkedin: 'linkedin.com/company/atelier-schmid' },
    aiSummary: 'Kleines, aber exklusives Design-Atelier. Margenstarke Spezialaufträge, jedoch notorisch schlechte Zahlungsmoral. Liquidität oft erst nach Projekt-Abschluss gegeben.',
    tags: ['Design', 'Spezialanfertigung', 'Vorkasse prüfen'],
    creditRating: 'B- (Achtung)',`,
      'Kirche St. Martin': `
    companyInfo: { industry: 'Kirchliche Einrichtung', size: 'K.A.', founded: '13. Jahrhundert' },
    aiSummary: 'Historische Kirchengemeinde. Aufträge kommen selten, aber umfassen oft sehr alte, unersetzliche Artefakte. Entscheidungen dauern wegen Gremien extrem lange.',
    tags: ['Historisch', 'Gremien-Entscheid', 'Unersetzlich'],
    creditRating: 'AA',`,
      'Privatkunde Lenz': `
    aiSummary: 'Solventer Privatkunde (Oldtimer-Liebhaber). Restaurauriert aktuell einen Porsche 911 Classic. Zahlt pünktlich, diskutiert aber gerne über den Preis.',
    tags: ['Oldtimer', 'Privat', 'Preisbewusst'],
    creditRating: 'A (Privat)',`,
      'Antik Galerie Main': `
    companyInfo: { industry: 'Kunsthandel', size: '5-15 Mitarbeiter', website: 'antik-main.ch', founded: '1988' },
    aiSummary: 'Etablierte Antik-Galerie. Benötigt oft Serien-Restaurationen (z.B. Kronleuchter-Teile). Sehr verlässlich und unkompliziert.',
    tags: ['B2B', 'Galerie', 'Stammkunde'],
    creditRating: 'A+',`
    };

    for (const [name, enrich] of Object.entries(enrichments)) {
      const searchRegex = new RegExp(`name: ['"]${name}['"],\\s*type:`);
      content = content.replace(searchRegex, `name: '${name}',\n    ${enrich}\n    type:`);
    }

    fs.writeFileSync('src/lib/mockCustomersExtended.ts', content);
    console.log('Mock customers enriched');
} catch(e) {
    console.error(e);
}
