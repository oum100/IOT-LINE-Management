#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
ENDPOINT="$BASE_URL/api/device/register"

run_case () {
  local name="$1"
  local file="$2"
  echo "\n===== $name ====="
  echo "POST $ENDPOINT"
  curl -sS -X POST "$ENDPOINT" \
    -H 'Content-Type: application/json' \
    --data "@$file" | jq .
}

run_case "01 success" "docs/iot-register-tests/payloads/01-success.json"
run_case "01.1 success new iot device" "docs/iot-register-tests/payloads/01-success-new-iot-device.json"
run_case "01.2 success new machine" "docs/iot-register-tests/payloads/01-success-new-machine.json"
run_case "02 invalid registration code" "docs/iot-register-tests/payloads/02-invalid-registration-code.json"
run_case "03 expired or not-ready code" "docs/iot-register-tests/payloads/03-expired-or-not-ready-code.json"
run_case "04 invalid serial length" "docs/iot-register-tests/payloads/04-invalid-machine-serial-length.json"
run_case "05 invalid machine kind" "docs/iot-register-tests/payloads/05-invalid-machine-kind.json"
run_case "06 missing required field" "docs/iot-register-tests/payloads/06-missing-required-field.json"
