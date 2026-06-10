#!/usr/bin/env bash
# nb.sh "<prompt>" <out.png> [src-ref.png]
# Nano Banana 2 (Google AI Studio): budget-check → generate/edit → save → register.
set -euo pipefail
source /Users/Osman/Desktop/APPS/agent-studio/.env
KEY="${GOOGLE_AI_STUDIO_KEY:?GOOGLE_AI_STUDIO_KEY fehlt}"

PROMPT="$1"
OUT="$2"
SRC="${3:-}"
MODEL="gemini-3.1-flash-image-preview"
STUDIO=/Users/Osman/Desktop/APPS/agent-studio
COST=0.05

node "$STUDIO/commandcenter/scripts/lib/budget-guard.js" check image "$COST" >&2

if [ -n "$SRC" ]; then
  TMP=$(mktemp)
  base64 -i "$SRC" | tr -d '\n' > "$TMP"
  REQFILE=$(mktemp)
  jq -n --arg p "$PROMPT" --rawfile d "$TMP" \
    '{contents:[{parts:[{text:$p},{inline_data:{mime_type:"image/png",data:$d}}]}]}' > "$REQFILE"
  rm -f "$TMP"
else
  REQFILE=$(mktemp)
  jq -n --arg p "$PROMPT" '{contents:[{parts:[{text:$p}]}]}' > "$REQFILE"
fi

RESP=$(curl -sS -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}" \
  -H "Content-Type: application/json" -d @"$REQFILE")
rm -f "$REQFILE"

IMG_B64=$(echo "$RESP" | jq -r '.candidates[0].content.parts[]? | (.inline_data // .inlineData) | select(.) | .data' | head -n1)
if [ -z "$IMG_B64" ] || [ "$IMG_B64" = "null" ]; then
  echo "ERROR: kein Bild in der Antwort" >&2
  echo "$RESP" | jq -c '.candidates[0].finishReason? // .error? // .' >&2 | head -c 500
  exit 1
fi
echo "$IMG_B64" | base64 -d > "$OUT"

"$STUDIO/commandcenter/scripts/register-generation.sh" "$OUT" \
  --prompt "$PROMPT" --model "$MODEL (Nano Banana 2)" \
  --cost-eur "$COST" --cost-category image >&2 || true
echo "$OUT"
