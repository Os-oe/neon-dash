#!/usr/bin/env bash
# sfx.sh "<prompt>" <out.mp3> [duration] [loop] — ElevenLabs SFX V2 via Kie.ai
set -euo pipefail
source /Users/Osman/Desktop/APPS/agent-studio/.env
: "${KIE_API_KEY:?KIE_API_KEY fehlt}"

PROMPT="$1"
OUT="$2"
DUR="${3:-}"
LOOP="${4:-false}"
STUDIO=/Users/Osman/Desktop/APPS/agent-studio
COST=0.04

node "$STUDIO/commandcenter/scripts/lib/budget-guard.js" check audio "$COST" >&2

INPUT=$(jq -nc --arg t "$PROMPT" --argjson l "$LOOP" \
  '{text:$t, prompt_influence:0.45, loop:$l, output_format:"mp3_44100_128"}')
if [ -n "$DUR" ]; then INPUT=$(echo "$INPUT" | jq -c --argjson d "$DUR" '. + {duration_seconds:$d}'); fi

TID=$(curl -s -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer $KIE_API_KEY" -H "Content-Type: application/json" \
  -d "$(jq -nc --argjson i "$INPUT" '{model:"elevenlabs/sound-effect-v2", input:$i}')" \
  | jq -r '.data.taskId')
[ "$TID" != "null" ] || { echo "createTask fehlgeschlagen" >&2; exit 1; }

for i in $(seq 1 60); do
  R=$(curl -s "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=$TID" -H "Authorization: Bearer $KIE_API_KEY")
  S=$(echo "$R" | jq -r '.data.state')
  case "$S" in
    success)
      URL=$(echo "$R" | jq -r '.data.resultJson | fromjson | .resultUrls[0]')
      curl -sLo "$OUT" "$URL"
      "$STUDIO/commandcenter/scripts/register-generation.sh" "$OUT" \
        --prompt "$PROMPT" --model "elevenlabs-sfx-v2 (Kie.ai)" \
        --cost-eur "$COST" --cost-category audio >&2 || true
      echo "$OUT"
      exit 0 ;;
    fail) echo "FAIL: $(echo "$R" | jq -r '.data.failMsg')" >&2; exit 1 ;;
    *) sleep 2 ;;
  esac
done
echo "timeout" >&2; exit 1
