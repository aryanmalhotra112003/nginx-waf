#!/usr/bin/env bash
# Integration smoke tests against local WAF (Docker Compose).
# Usage: ./test-attacks.sh [WAF_HOST[:PORT]]
# Default: localhost:18080
#
# Use a browser-like User-Agent so nginx bot-map does not block curl.
# Expected: clean traffic 200; OWASP-style abuse 403; rate limit 429.

set -euo pipefail

UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

BASE="${1:-localhost:18080}"
BASE="${BASE#http://}"
BASE="${BASE#https://}"
WAF_URL="http://${BASE}"

echo "==> Target WAF: ${WAF_URL}"
echo

echo "1) Clean traffic (expect HTTP 200)"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -A "$UA" "${WAF_URL}/"
echo

echo "2) SQL injection (expect HTTP 403)"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -A "$UA" \
  "${WAF_URL}/search?q=%27%20OR%20%271%27%3D%271"
echo

echo "3) XSS (expect HTTP 403)"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -A "$UA" \
  "${WAF_URL}/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E"
echo

echo "4) Path traversal / LFI (expect HTTP 403)"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -A "$UA" \
  "${WAF_URL}/search?q=..%2F..%2Fetc%2Fpasswd"
echo

echo "5) Rate limiting / DoS burst (expect HTTP 404 then HTTP 429)"
for i in $(seq 1 25); do
  code=$(curl -sS -o /dev/null -w "%{http_code}" -A "$UA" "${WAF_URL}/rate-limit-probe-${i}")
  echo "  request ${i}: HTTP ${code}"
done
echo

echo "==> Done. Verify dashboard + logs (see project audit / verification section)."
