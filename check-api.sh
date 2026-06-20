#!/bin/bash
# Smoke-test all gateway API endpoints. Landing flow is the headline check.
GW="${GATEWAY_URL:-http://localhost:8000}"

hr() { printf '%s\n' "----------------------------------------"; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

echo "Gateway: $GW"
hr
echo "HEALTH & ROUTES"
printf "  GET  /health              -> %s\n" "$(code $GW/health)"
printf "  GET  /api/airport/queue   -> %s\n" "$(code $GW/api/airport/queue)"
printf "  GET  /api/hotel/rooms     -> %s\n" "$(code $GW/api/hotel/rooms)"
printf "  GET  /api/beach/activities-> %s\n" "$(code $GW/api/beach/activities)"

hr
echo "LANDING FLOW  (POST arrival -> poll until processed)"
GID="land-check-$(date +%s)"
echo "  guest_id: $GID"
POST=$(curl -s -w "\n%{http_code}" -X POST "$GW/api/airport/arrivals" \
  -H "Content-Type: application/json" \
  -d "{\"guest_id\":\"$GID\",\"name\":\"Test\",\"surname\":\"Guest\",\"age\":30,\"passport_type\":\"EU\",\"priority\":\"standard\"}")
echo "  POST /api/airport/arrivals -> HTTP $(echo "$POST" | tail -1)"
echo "       $(echo "$POST" | sed '$d')"

LANDED=no
for i in $(seq 1 15); do
  ST=$(curl -s "$GW/api/airport/arrivals/$GID")
  STATUS=$(echo "$ST" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
  printf "  poll %-2s status=%s\n" "$i" "${STATUS:-?}"
  if [ "$STATUS" = "processed" ]; then LANDED=yes; break; fi
  sleep 2
done
hr
if [ "$LANDED" = yes ]; then
  echo "  >>> LANDED ✓"
else
  echo "  >>> NOT landed after polling (check airport/broadcast logs)"
fi
