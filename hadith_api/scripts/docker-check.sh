#!/usr/bin/env bash
# Static validation of the container build (§25) for environments with no
# Docker daemon: every path the Dockerfile and compose file reference must
# exist, and the entrypoint must be runnable. The real build runs in CI.
set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0
note() { printf '%-54s %s\n' "$1" "$2"; }

echo "============ DOCKER BUILD CHECK ============"
if docker info >/dev/null 2>&1; then
  note "docker daemon" "available — running a real build"
  docker build -t falah-hadith-api:check . || FAIL=1
else
  note "docker daemon" "UNAVAILABLE — static checks only"
fi

for f in Dockerfile docker-compose.yml package.json package-lock.json openapi.yaml; do
  [ -f "$f" ] && note "file: $f" "PASS" || { note "file: $f" "FAIL"; FAIL=1; }
done

# every COPY source in the Dockerfile must exist in the build context
while read -r src; do
  [ -e "$src" ] && note "COPY $src" "PASS" || { note "COPY $src" "FAIL — missing"; FAIL=1; }
done < <(grep -E '^COPY ' Dockerfile | awk '{print $2}' | grep -v '^\*' | sed 's#\./##')

ENTRY=$(grep -E '^CMD' Dockerfile | grep -o 'src/[^"]*\.ts' | head -1)
[ -n "$ENTRY" ] && [ -f "$ENTRY" ] && note "entrypoint: $ENTRY" "PASS" || { note "entrypoint" "FAIL"; FAIL=1; }

# compose must mount paths that exist and must not bake a secret
for path in migrations scripts; do
  [ -d "$path" ] && note "compose mount: ./$path" "PASS" || { note "compose mount: ./$path" "FAIL"; FAIL=1; }
done
if grep -qE '(PASSWORD|SECRET|KEY): *[A-Za-z0-9]{12,}' docker-compose.yml; then
  note "no hard-coded secret in compose" "FAIL"; FAIL=1
else
  note "no hard-coded secret in compose" "PASS"
fi
if grep -q "CONTENT_LICENSE_CONFIRMED: \${CONTENT_LICENSE_CONFIRMED:-false}" docker-compose.yml; then
  note "compose ships the licence gate closed" "PASS"
else
  note "compose ships the licence gate closed" "FAIL"; FAIL=1
fi

echo
[ "$FAIL" -eq 0 ] && echo "DOCKER CHECK: PASS" || echo "DOCKER CHECK: FAIL"
echo "============================================"
exit "$FAIL"
