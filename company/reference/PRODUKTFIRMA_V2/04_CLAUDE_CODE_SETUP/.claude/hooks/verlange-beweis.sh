#!/usr/bin/env bash
# Verlangt Beweis-Artefakte, bevor eine Mission als 'fertig' gilt.
# Prueft, ob seit Missionsstart Belege erzeugt wurden. Exit 2 = Stop blockieren (zurueck an Builder).
# Bewusst einfach gehalten; in der Praxis pro Mission verfeinern (z.B. Marker-Datei je Akzeptanzkriterium).
set -euo pipefail

LEDGER=".claude/_evidence_aktuelle_mission.txt"

# Wenn kein Ledger existiert oder leer -> noch kein Beweis -> blockieren
if [[ ! -s "$LEDGER" ]]; then
  echo "STOP BLOCKIERT durch verlange-beweis.sh:" >&2
  echo "Keine Beweis-Artefakte in $LEDGER gefunden." >&2
  echo "Trage pro Akzeptanzkriterium einen Beleg ein (tsc/lint/test-Log, SELECT-Beweis, Screenshot, curl-200, Deployment-ID)." >&2
  echo "Erst dann darf die Mission als fertig gelten und an den Chief Verifier (GPT-5) gehen." >&2
  exit 2
fi

# Mindest-Pflichtbelege pruefen (Beispielhafte Schluesselwoerter)
need=("tsc" "lint" "test")
fehlt=()
for k in "${need[@]}"; do
  grep -qi "$k" "$LEDGER" || fehlt+=("$k")
done

if (( ${#fehlt[@]} > 0 )); then
  echo "STOP BLOCKIERT: Es fehlen Pflichtbelege: ${fehlt[*]}" >&2
  echo "Definition of Done verlangt mindestens tsc/lint/test + persistenz-/UI-/live-Belege je nach Mission." >&2
  exit 2
fi

echo "Beweis-Vorpruefung ok. Weiterleitung an Chief Verifier (GPT-5) zur Abnahme." >&2
exit 0
