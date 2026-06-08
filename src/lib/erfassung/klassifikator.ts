export function bildeSchluessel(klasse: string, oberflaeche: string): string {
  return normalizeString(klasse) + '|' + normalizeString(oberflaeche);
}

export function normalizeString(str: string): string {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

export function klassifiziereTeil(
  teilName: string, 
  klassifikatorListe: { klasse: string; keywords: string[] }[]
): string {
  const name = normalizeString(teilName);
  
  for (const item of klassifikatorListe) {
    for (const keyword of item.keywords) {
      if (name.includes(normalizeString(keyword))) {
        return item.klasse;
      }
    }
  }
  
  return 'sonstiges';
}
