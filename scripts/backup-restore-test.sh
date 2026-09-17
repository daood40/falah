#!/usr/bin/env bash
# Backup and RESTORE test (§29). A backup nobody restored is not a backup.
#
# Dumps the live database, restores it into a scratch database, and compares the
# dataset fingerprint and every table count. Nothing touches the source database.
#
#   DATABASE_URL=postgresql://… bash scripts/backup-restore-test.sh
set -euo pipefail

SRC_URL="${DATABASE_URL:?DATABASE_URL is required}"
SRC_DB="${SRC_URL##*/}"
RESTORE_DB="${RESTORE_DB:-falah_restore_test}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/falah-backup}"
DATASET="${DATASET:-JAMI-KAMIL-1437-V1}"
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DUMP="$BACKUP_DIR/${SRC_DB}-${STAMP}.dump"

as_postgres() { su postgres -c "$1" 2>/dev/null || sudo -u postgres bash -c "$1"; }
fingerprint() { psql "$1" -At -c "select corpus.compute_dataset_hash('$DATASET')"; }
counts() {
  psql "$1" -At -c "select table_name || '=' || (xpath('/row/c/text()',
      query_to_xml(format('select count(*) as c from corpus.%I', table_name), false, true, '')))[1]::text::int
    from information_schema.tables
    where table_schema='corpus' and table_type='BASE TABLE' order by table_name"
}

echo "============ BACKUP & RESTORE TEST ============"
echo "source database     $SRC_DB"
SRC_HASH=$(fingerprint "$SRC_URL")
echo "dataset fingerprint $SRC_HASH"

echo "→ dumping"
pg_dump --format=custom --file="$DUMP" "$SRC_URL"
DUMP_SHA=$(sha256sum "$DUMP" | cut -d' ' -f1)
echo "   $DUMP"
echo "   $(du -h "$DUMP" | cut -f1)  sha256=${DUMP_SHA:0:32}…"

echo "→ restoring into a scratch database ($RESTORE_DB)"
as_postgres "dropdb --if-exists $RESTORE_DB"
as_postgres "createdb -O falah $RESTORE_DB"
RESTORE_URL="${SRC_URL%/*}/$RESTORE_DB"
pg_restore --no-owner --no-privileges --dbname "$RESTORE_URL" "$DUMP" >/dev/null 2>&1 || true

echo "→ comparing"
DST_HASH=$(fingerprint "$RESTORE_URL")
echo "restored fingerprint $DST_HASH"

FAIL=0
if [ "$SRC_HASH" = "$DST_HASH" ] && [ -n "$SRC_HASH" ]; then
  echo "PASS  dataset fingerprint is identical after restore"
else
  echo "FAIL  dataset fingerprint changed during backup/restore"; FAIL=1
fi

DIFF=$(diff <(counts "$SRC_URL") <(counts "$RESTORE_URL") || true)
if [ -z "$DIFF" ]; then
  echo "PASS  every corpus table has the same row count after restore"
else
  echo "FAIL  table counts differ:"; echo "$DIFF"; FAIL=1
fi

SRC_LOCK=$(psql "$RESTORE_URL" -At -c "select count(*) from corpus.hadiths where not source_locked")
if [ "$SRC_LOCK" = "0" ]; then
  echo "PASS  restored records are still source_locked"
else
  echo "FAIL  $SRC_LOCK restored records lost their lock"; FAIL=1
fi

as_postgres "dropdb --if-exists $RESTORE_DB"
echo "kept backup: $DUMP"
[ "$FAIL" -eq 0 ] && echo "BACKUP/RESTORE: PASS" || echo "BACKUP/RESTORE: FAIL"
echo "==============================================="
exit "$FAIL"
