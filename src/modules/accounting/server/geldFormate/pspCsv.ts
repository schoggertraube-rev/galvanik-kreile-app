import { leseProfilAuszug, type ImportProfil } from './csvProfil';

export function lesePspAbrechnung(bytes: Uint8Array, profil: ImportProfil) {
  return leseProfilAuszug(bytes, profil, satz => {
    switch (satz) {
      case 'Anfang': return 'anfang';
      case 'Ende': return 'ende';
      case 'Verkauf': return 'kartenverkauf';
      case 'Gebühr': return 'anbietergebuehr';
      case 'Auszahlung': return 'anbieterauszahlung';
      case 'Einbehalt': return 'anbietereinbehalt';
    }
  }, (bewegung, roherWert) => {
    const settlementId = roherWert('settlementId');
    return { ...bewegung, settlementId: settlementId?.trim() ? settlementId : null };
  });
}
