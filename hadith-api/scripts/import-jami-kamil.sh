#!/usr/bin/env bash
# Imports «الجامع الكامل» volume by volume, in print order.
#
#   bash scripts/import-jami-kamil.sh --dry-run     # parse + validate only
#   bash scripts/import-jami-kamil.sh               # write to the database
#
# The source files live in hadith-api/data/ (git-ignored: the content licence is
# not confirmed, and this repository is public).
set -euo pipefail

DATA_DIR="${DATA_DIR:-data}"
EDITION="${EDITION:-jami-kamil-1437}"
DATASET="${DATASET:-JAMI-KAMIL-1437-V1}"
ACTOR="${ACTOR:-import-script}"
EXTRA=("$@")

shopt -s nullglob
files=("$DATA_DIR"/jami-kamil-j*.txt)
if [ ${#files[@]} -eq 0 ]; then
  echo "no source volumes in $DATA_DIR/ (expected jami-kamil-jNN.txt)" >&2
  exit 1
fi

echo "volumes: ${#files[@]}  edition: $EDITION  dataset: $DATASET"
for f in "${files[@]}"; do
  echo "──────────────────────────────────────────────"
  echo "▶ $f"
  node --experimental-strip-types src/importer/cli.ts \
    --file "$f" --adapter jami_kamil_shamela \
    --edition "$EDITION" --dataset "$DATASET" --actor "$ACTOR" "${EXTRA[@]}"
done
