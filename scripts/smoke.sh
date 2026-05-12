#!/usr/bin/env bash
# Telerady smoke test — bash-only checks against a running stack.
#
# Usage:
#   bash scripts/smoke.sh
#   API_URL=http://localhost:3000 bash scripts/smoke.sh   # override default
#
# Assumes:
#   * docker compose dev stack is up.
#   * `npm run seed:demo` has been executed.
#
# Exits non-zero on the first failure.

set -euo pipefail

API="${API_URL:-http://localhost:3000}"
EMAIL_RADIO="pepa@telerady.test"
PASSWORD_RADIO="RadDemo!2026"
EMAIL_ADMIN="admin@telerady.test"
PASSWORD_ADMIN="AdminDemo!2026"

green()  { printf '\033[32m%s\033[0m\n' "$1"; }
red()    { printf '\033[31m%s\033[0m\n' "$1"; }
section(){ printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

require() {
  local name="$1"; shift
  command -v "$1" >/dev/null 2>&1 || { red "Missing dependency: $1 (need $name)"; exit 1; }
}
require "curl" curl
require "jq"   jq

login() {
  local email="$1" password="$2"
  local resp
  resp=$(curl -sf -c /tmp/telerady.cookies -X POST "$API/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}") || { red "login failed for $email"; return 1; }
  echo "$resp" | jq -r '.accessToken'
}

assert_status() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    green "  ✓ $label ($actual)"
  else
    red "  ✗ $label — expected $expected got $actual"
    exit 1
  fi
}

section "health"
status=$(curl -sf -o /dev/null -w '%{http_code}' "$API/api-docs/v1-json" || true)
[[ "$status" == "200" ]] && green "  ✓ swagger reachable" || { red "API not reachable at $API"; exit 1; }

section "auth (radiologist)"
RADIO=$(login "$EMAIL_RADIO" "$PASSWORD_RADIO")
[[ -n "$RADIO" && "$RADIO" != "null" ]] && green "  ✓ radiologist login" || { red "radiologist login failed"; exit 1; }

section "/v1/auth/me"
ME=$(curl -sf "$API/v1/auth/me" -H "Authorization: Bearer $RADIO")
echo "$ME" | jq -e '.roles | index("radiologist")' >/dev/null && green "  ✓ JWT carries radiologist role" || { red "missing radiologist role"; exit 1; }

section "/v1/worklist"
WL=$(curl -sf "$API/v1/worklist?limit=10" -H "Authorization: Bearer $RADIO")
TOTAL=$(echo "$WL" | jq -r '.total')
[[ "$TOTAL" -ge "1" ]] && green "  ✓ worklist returns $TOTAL entries" || { red "worklist empty"; exit 1; }
STUDY_ID=$(echo "$WL" | jq -r '.entries[0].id')
PAT_NAME=$(echo "$WL" | jq -r '.entries[0].patName')
[[ "$PAT_NAME" != "null" && -n "$PAT_NAME" ]] && green "  ✓ patName decrypted ($PAT_NAME)" || red "  ! patName missing (¿no hay demo seed?)"

section "/v2/reports — autosave + sign"
curl -sf -X PUT "$API/v2/reports/$STUDY_ID" \
  -H "Authorization: Bearer $RADIO" -H 'Content-Type: application/json' \
  -d '{"contents":{"modality":"CT","sections":[{"key":"findings","title":"Findings","body":"Smoke test"},{"key":"conclusion","title":"Conclusion","body":"OK"}]}}' \
  >/dev/null && green "  ✓ draft saved"

SIGN=$(curl -sf -X POST "$API/v2/reports/$STUDY_ID/sign" \
  -H "Authorization: Bearer $RADIO" -H 'Content-Type: application/json' \
  -d '{"policy":"name_collegiate"}')
echo "$SIGN" | jq -e '.state == "signed"' >/dev/null && green "  ✓ report signed" || { red "sign failed"; echo "$SIGN"; exit 1; }
PDF_URL=$(echo "$SIGN" | jq -r '.pdfUrl')
[[ "$PDF_URL" != "null" && -n "$PDF_URL" ]] && green "  ✓ PDF URL issued" || red "  ! PDF URL missing"

section "/v1/auth/login (admin) + /admin/audit"
ADMIN=$(login "$EMAIL_ADMIN" "$PASSWORD_ADMIN")
AUDIT=$(curl -sf "$API/v1/admin/audit?limit=10" -H "Authorization: Bearer $ADMIN")
echo "$AUDIT" | jq -e '.total >= 1' >/dev/null && green "  ✓ audit list returns rows" || { red "audit list empty"; exit 1; }

VERIFY=$(curl -sf -X POST "$API/v1/admin/audit/verify" -H "Authorization: Bearer $ADMIN")
echo "$VERIFY" | jq -e '.ok == true' >/dev/null && green "  ✓ audit chain verified ($(echo "$VERIFY" | jq -r '.checkedRows') rows)" || { red "audit chain TAMPERED"; echo "$VERIFY"; exit 1; }

section "/fhir/metadata"
META_STATUS=$(curl -sf -o /tmp/meta.json -w '%{http_code}' "$API/fhir/metadata" -H "Authorization: Bearer $ADMIN")
assert_status "fhir metadata" 200 "$META_STATUS"
jq -e '.resourceType == "CapabilityStatement"' /tmp/meta.json >/dev/null && green "  ✓ fhir capabilities OK" || red "  ! capability statement malformed"

section "rgpd"
EXPORT_STATUS=$(curl -sf -o /tmp/export.json -w '%{http_code}' "$API/v1/me/data-export" -H "Authorization: Bearer $RADIO")
assert_status "GET /v1/me/data-export" 200 "$EXPORT_STATUS"

green "\nAll smoke checks passed."
