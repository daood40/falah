#!/usr/bin/env bash
# FALAH Quran API — cURL examples.
# Usage: FALAH_API_BASE_URL=https://api.example.com ./curl.sh
set -euo pipefail

BASE="${FALAH_API_BASE_URL:?set FALAH_API_BASE_URL, e.g. https://api.example.com}"
API="$BASE/api/v1"

echo "== health ==";        curl -sS "$API/health"                 | head -c 400; echo
echo "== version ==";       curl -sS "$API/version"                | head -c 400; echo
echo "== stats ==";         curl -sS "$API/stats"                  | head -c 400; echo
echo "== sources ==";       curl -sS "$API/sources"                | head -c 400; echo
echo "== surahs ==";        curl -sS "$API/surahs?limit=3"         | head -c 400; echo
echo "== surah 1 ==";       curl -sS "$API/surahs/1"               | head -c 400; echo
echo "== surah 1 ayahs =="; curl -sS "$API/surahs/1/ayahs?limit=2" | head -c 400; echo
echo "== ayah 2:255 ==";    curl -sS "$API/ayahs/by-key/2:255"     | head -c 400; echo
echo "== search ==";        curl -sSG "$API/search" --data-urlencode "q=الحمد لله" -d limit=3 | head -c 400; echo
echo "== juzs ==";          curl -sS "$API/juzs"                   | head -c 200; echo
echo "== page 1 ==";        curl -sS "$API/pages/1"                | head -c 300; echo
echo "== openapi ==";       curl -sS "$API/openapi.yaml"           | head -3

# Authenticated calls (Supabase access token):
# curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" "$API/me/bookmarks"
# curl -sS -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
#      -H 'content-type: application/json' \
#      -d '{"ayah_id":"<uuid>"}' "$API/me/bookmarks"
