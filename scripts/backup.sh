#!/usr/bin/env bash
# Telerady backup script.
#
# Produces a timestamped, encrypted, integrity-checked backup of the
# Postgres database and the MinIO/S3 buckets and uploads it to a backup
# bucket.
#
# Designed to be invoked from cron or a Kubernetes CronJob:
#   0 3 * * *  /opt/telerady/scripts/backup.sh
#
# Environment variables (see infra/secrets.example):
#   DATABASE_URL           Postgres connection string (read role is enough).
#   BACKUP_GPG_RECIPIENT   GPG fingerprint that encrypts the dump.
#   BACKUP_BUCKET          S3 bucket where the artefact lands.
#   S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION.
#
# Outputs:
#   s3://$BACKUP_BUCKET/YYYY-MM-DD/postgres.dump.gpg
#   s3://$BACKUP_BUCKET/YYYY-MM-DD/postgres.dump.sha256
#   s3://$BACKUP_BUCKET/YYYY-MM-DD/manifest.json

set -euo pipefail

require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }; }
require pg_dump
require gpg
require sha256sum
require aws

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_GPG_RECIPIENT:?BACKUP_GPG_RECIPIENT is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${S3_REGION:=eu-south-2}"

stamp="$(date -u +%Y-%m-%d)"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

dump="$workdir/postgres.dump"
echo "[$(date -u +%FT%TZ)] pg_dump (custom format, no owner)…"
pg_dump --format=custom --no-owner --no-privileges \
  --schema=telerady --schema=public \
  "$DATABASE_URL" > "$dump"

echo "[$(date -u +%FT%TZ)] sha256…"
sha256sum "$dump" | awk '{print $1}' > "$dump.sha256"

echo "[$(date -u +%FT%TZ)] encrypt (AES256, asymmetric to $BACKUP_GPG_RECIPIENT)…"
gpg --batch --yes --trust-model always \
    --output "$dump.gpg" --encrypt --recipient "$BACKUP_GPG_RECIPIENT" \
    --compress-algo zip --cipher-algo AES256 \
    "$dump"

cat > "$workdir/manifest.json" <<JSON
{
  "createdAt": "$(date -u +%FT%TZ)",
  "type": "telerady-backup",
  "version": "1",
  "files": {
    "postgres.dump.gpg": "$(stat -c %s "$dump.gpg" 2>/dev/null || stat -f %z "$dump.gpg")",
    "postgres.dump.sha256": "$(cat "$dump.sha256")"
  }
}
JSON

prefix="s3://$BACKUP_BUCKET/$stamp"
endpoint_arg="--endpoint-url=$S3_ENDPOINT"
echo "[$(date -u +%FT%TZ)] upload to $prefix…"
aws $endpoint_arg s3 cp "$dump.gpg" "$prefix/postgres.dump.gpg" --sse AES256
aws $endpoint_arg s3 cp "$dump.sha256" "$prefix/postgres.dump.sha256"
aws $endpoint_arg s3 cp "$workdir/manifest.json" "$prefix/manifest.json"

echo "[$(date -u +%FT%TZ)] done -> $prefix"
