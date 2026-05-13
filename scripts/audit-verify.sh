#!/usr/bin/env bash
# Telerady audit hash-chain verifier.
#
# Calls POST /v1/admin/audit/verify with the operator service token and
# fails (exit 1) if the chain is broken or the API is unreachable. Wire
# it into cron + PagerDuty:
#
#   0 4 * * *  /opt/telerady/scripts/audit-verify.sh \
#                >> /var/log/telerady/audit.log 2>&1
#
# Environment:
#   TELERADY_API_URL      e.g. https://api.telerady.es
#   AUDIT_SERVICE_TOKEN   admin JWT with audit:verify permission.
#                         Rotate quarterly; store in Vault under
#                         secret/telerady/audit/service-token.
#
# Exit codes:
#   0 — chain is intact.
#   1 — chain broken OR API unreachable OR auth failed.
#
# On exit != 0 the wrapper that PagerDuty calls turns this into a
# severity-1 incident.

set -euo pipefail

require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }; }
require curl
require jq

: "${TELERADY_API_URL:?TELERADY_API_URL required}"
: "${AUDIT_SERVICE_TOKEN:?AUDIT_SERVICE_TOKEN required}"

URL="${TELERADY_API_URL%/}/v1/admin/audit/verify"

# Use --fail so HTTP 4xx/5xx end up as non-zero exit; --silent to skip
# progress noise; --show-error to keep the error message on stderr.
RESPONSE=$(
  curl --fail --silent --show-error --max-time 30 \
    -X POST "$URL" \
    -H "Authorization: Bearer $AUDIT_SERVICE_TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{}'
)

OK=$(echo "$RESPONSE" | jq -r '.ok // "missing"')
if [ "$OK" != "true" ]; then
  echo "Audit chain verification failed:" >&2
  echo "$RESPONSE" | jq . >&2 || echo "$RESPONSE" >&2
  exit 1
fi

# Report the chain length and the last verified id for grafana / logs.
COUNT=$(echo "$RESPONSE" | jq -r '.count // "?"')
LAST=$(echo "$RESPONSE" | jq -r '.lastVerifiedId // "?"')
printf '[%s] audit chain ok — count=%s lastVerifiedId=%s\n' \
  "$(date --utc +%FT%TZ)" "$COUNT" "$LAST"
