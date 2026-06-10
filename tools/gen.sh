#!/usr/bin/env bash
# gen.sh "<prompt>" <out.png> [ratio=1:1] [resolution=1K] [ref_url ...]
# GPT Image 2 (Kie.ai) T2I/I2I: budget-check → generate → poll → download → register.
set -euo pipefail
source /Users/Osman/Desktop/APPS/agent-studio/.env
: "${KIE_API_KEY:?KIE_API_KEY fehlt}"

PROMPT="$1"
OUT="$2"
RATIO="${3:-1:1}"
RES="${4:-1K}"
shift 4 || true
REFS=("$@")

STUDIO=/Users/Osman/Desktop/APPS/agent-studio
COST=0.04 # 1K-Render

node "$STUDIO/commandcenter/scripts/lib/budget-guard.js" check image "$COST" >&2

if [ ${#REFS[@]} -gt 0 ]; then
  URLS=$(printf '%s\n' "${REFS[@]}" | jq -R . | jq -sc .)
  BODY=$(jq -nc --arg p "$PROMPT" --arg r "$RATIO" --arg res "$RES" --argjson u "$URLS" \
    '{model:"gpt-image-2-image-to-image", input:{prompt:$p, aspect_ratio:$r, resolution:$res, input_urls:$u}}')
else
  BODY=$(jq -nc --arg p "$PROMPT" --arg r "$RATIO" --arg res "$RES" \
    '{model:"gpt-image-2-text-to-image", input:{prompt:$p, aspect_ratio:$r, resolution:$res}}')
fi

TASK_ID=$(curl -s -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer $KIE_API_KEY" -H "Content-Type: application/json" \
  -d "$BODY" | jq -r '.data.taskId')
[ "$TASK_ID" != "null" ] || { echo "createTask fehlgeschlagen" >&2; exit 1; }
echo "task: $TASK_ID" >&2

for i in $(seq 1 90); do
  RESP=$(curl -s "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=$TASK_ID" \
    -H "Authorization: Bearer $KIE_API_KEY")
  STATE=$(echo "$RESP" | jq -r '.data.state')
  case "$STATE" in
    success)
      URL=$(echo "$RESP" | jq -r '.data.resultJson | fromjson | .resultUrls[0]')
      curl -sLo "$OUT" "$URL"
      "$STUDIO/commandcenter/scripts/register-generation.sh" "$OUT" \
        --prompt "$PROMPT" --model "gpt-image-2 (Kie.ai)" \
        --cost-eur "$COST" --cost-category image >&2 || true
      echo "$OUT"
      exit 0 ;;
    fail)
      echo "FAIL: $(echo "$RESP" | jq -r '.data.failMsg')" >&2; exit 1 ;;
    *) sleep 2 ;;
  esac
done
echo "timeout" >&2; exit 1
