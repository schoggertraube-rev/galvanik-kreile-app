export function bildeSchluessel(klasse: string, oberflaeche: string): string {
  return normalizeString(klasse) + '|' + normalizeString(oberflaeche);
}

const LATIN_FOLD: Record<string, string> = {
  ä: "ae", ö: "oe", ü: "ue", ß: "ss",
  á: "a", à: "a", â: "a", ã: "a", å: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", õ: "o",
  ú: "u", ù: "u", û: "u", ç: "c", ñ: "n",
};

export function normalizeString(str: string | null | undefined): string {
  if (typeof str !== "string") return "";
  return str.normalize("NFC").toLowerCase().trim()
    .replace(/[äöüßáàâãåéèêëíìîïóòôõúùûçñ]/g, (character) => LATIN_FOLD[character]);
}

export function klassifiziereTeil(
  teilName: string, 
  klassifikatorListe: { klasse: string; keywords: string[] }[]
): string {
  const name = normalizeString(teilName);
  let bestMatch: { klasse: string; keywordLength: number } | null = null;

  for (const item of klassifikatorListe) {
    for (const keyword of item.keywords) {
      const normalizedKeyword = normalizeString(keyword);
      if (normalizedKeyword && name.includes(normalizedKeyword)
        && (!bestMatch || normalizedKeyword.length > bestMatch.keywordLength)) {
        bestMatch = { klasse: item.klasse, keywordLength: normalizedKeyword.length };
      }
    }
  }

  return bestMatch?.klasse || "sonstiges";
}
