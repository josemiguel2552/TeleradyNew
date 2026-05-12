#!/usr/bin/env bash
# Telerady restore script. Companion to backup.sh.
#
# Usage:
#   ./scripts/restore.sh 2026-01-15  postgres://app:secret@host/telerady_restore
#
# Pulls the encrypted dump from $BACKUP_BUCKET, verifies the sha256,
# decrypts with the operator's private key (must be in the local
# gnupg keyring), and pg_restores into the target connection string.
#
# Restore goes into a separate database; never run this against the
# live database directly. The runbook (docs/DR-PLAN.md) explains the
# cut-over procedure.

set -euo pipefail
stamp="${1:-}"
target="${2:-}"
if [[ -z "$stamp" || -z "$target" ]]; then
  echo "usage: $0 <YYYY-MM-DD> <DATABASE_URL>"
  exit 1
fi

require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1" >&2; exit 1; }; }
require aws; require gpg; require sha256sum; require pg_restore

: "${BACKUP_BUCKET:?BACKUP_BUCKET required}"
: "${S3_ENDPOINT:?S3_ENDPOINT required}"
endpoint_arg="--endpoint-url=$S3_ENDPOINT"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

prefix="s3://$BACKUP_BUCKET/$stamp"
echo "[$(date -u +%FT%TZ)] downloading from $prefix…"
aws $endpoint_arg s3 cp "$prefix/postgres.dump.gpg" "$workdir/postgres.dump.gpg"
aws $endpoint_arg s3 cp "$prefix/postgres.dump.sha256" "$workdir/postgres.dump.sha256"

echo "[$(date -u +%FT%TZ)] decrypting…"
gpg --batch --yes --output "$workdir/postgres.dump" --decrypt "$workdir/postgres.dump.gpg"

echo "[$(date -u +%FT%TZ)] sha256 verify…"
expected="$(cat "$workdir/postgres.dump.sha256")"
actual="$(sha256sum "$workdir/postgres.dump" | awk '{print $1}')"
if [[ "$expected" != "$actual" ]]; then
  echo "  sha256 MISMATCH — expected $expected actual $actual" >&2
  exit 2
fi

echo "[$(date -u +%FT%TZ)] pg_restore into target…"
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="$target" "$workdir/postgres.dump"

echo "[$(date -u +%FT%TZ)] restore complete."
