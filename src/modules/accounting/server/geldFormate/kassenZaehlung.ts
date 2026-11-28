import { leseProfilAuszug, type ImportProfil } from './csvProfil';

export function leseKassenZaehlung(bytes: Uint8Array, profil: ImportProfil) {
  const { kopf, fehler } = leseProfilAuszug(bytes, profil, satz => {
    if (satz === 'Anfang') return 'anfang';
    if (satz === 'Ende') return 'ende';
  });
  return { anfangCents: kopf.anfangCents, endeCents: kopf.endeCents, tag: kopf.bis, fehler };
}
