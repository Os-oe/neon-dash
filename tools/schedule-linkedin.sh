#!/usr/bin/env bash
# Plant den NEON-DASH-Launch-Post auf LinkedIn via Blotato (Fr 12.06.2026, 09:30 Berlin).
# Voraussetzung: gültiger BLOTATO_API_KEY in agent-studio/.env
set -euo pipefail
source /Users/Osman/Desktop/APPS/agent-studio/.env
: "${BLOTATO_API_KEY:?BLOTATO_API_KEY fehlt}"
API="https://backend.blotato.com/v2"
H=(-H "blotato-api-key: $BLOTATO_API_KEY" -H "Content-Type: application/json")
VIDEO_URL="https://7waahguffejzoppq.public.blob.vercel-storage.com/promo/neon-dash-promo-v4.mp4"
SCHEDULE="2026-06-12T07:30:00Z"   # = 09:30 Europe/Berlin
DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ LinkedIn-Account suchen…"
ACC=$(curl -s "${H[@]}" "$API/users/me/accounts")
ACC_ID=$(echo "$ACC" | jq -r '(.items // .accounts // .) | map(select(.platform=="linkedin")) | .[0].id')
[ "$ACC_ID" != "null" ] && [ -n "$ACC_ID" ] || { echo "Kein LinkedIn-Account gefunden:"; echo "$ACC" | head -c 400; exit 1; }
echo "   accountId: $ACC_ID"

echo "→ Video zu Blotato-CDN spiegeln…"
MEDIA=$(curl -s "${H[@]}" -X POST "$API/media" -d "$(jq -nc --arg u "$VIDEO_URL" '{url:$u}')")
MEDIA_URL=$(echo "$MEDIA" | jq -r '.url')
[ "$MEDIA_URL" != "null" ] || { echo "Media-Upload fehlgeschlagen:"; echo "$MEDIA" | head -c 400; exit 1; }
echo "   media: $MEDIA_URL"

echo "→ Post planen für $SCHEDULE (09:30 Berlin)…"
BODY=$(jq -nc --arg acc "$ACC_ID" --rawfile t "$DIR/video/post-text.txt" --arg m "$MEDIA_URL" --arg s "$SCHEDULE" \
  '{post:{accountId:$acc, target:{targetType:"linkedin"}, content:{text:$t, platform:"linkedin", mediaUrls:[$m]}}, scheduledTime:$s}')
RESP=$(curl -s "${H[@]}" -X POST "$API/posts" -d "$BODY")
echo "$RESP" | head -c 500
echo ""
echo "✓ Fertig — Kontrolle: https://my.blotato.com/calendar"
