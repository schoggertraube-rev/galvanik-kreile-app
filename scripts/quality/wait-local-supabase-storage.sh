#!/usr/bin/env bash
set -euo pipefail

if [[ ! ${SUPABASE_URL:-} =~ ^http://(127\.0\.0\.1|localhost):[0-9]+/?$ ]]; then
  echo 'Storage-Bereitschaft erwartet den lokalen Supabase-Replay.' >&2
  exit 1
fi
: "${SUPABASE_SERVICE_ROLE_KEY:?Storage-Replay benötigt den lokalen Laufzeitschlüssel.}"

# The gateway can answer before Storage reconnects after a database reset.
bucket_url="${SUPABASE_URL%/}/storage/v1/bucket"
deadline=$((SECONDS + 60))
while true; do
  status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 2 --max-time 3 \
    --header "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    --header "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "$bucket_url") || status=000

  case "$status" in
    200)
      echo 'Lokaler Storage bereit.'
      exit 0
      ;;
    000|502|503|504) ;;
    *)
      echo "Lokaler Storage meldet unerwartet HTTP $status." >&2
      exit 1
      ;;
  esac

  if (( SECONDS >= deadline )); then
    echo "Lokaler Storage blieb nach 60 Sekunden unerreichbar (HTTP $status)." >&2
    exit 1
  fi
  sleep 2
done
