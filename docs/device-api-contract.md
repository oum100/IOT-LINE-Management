# Device API Contract

Status: Draft for implementation alignment (Firmware + Backend)
Last updated: 2026-05-10

## Overview
This contract defines the production device lifecycle APIs:
1. `POST /api/device/register`
2. `POST /api/device/activate` (or equivalent bind flow via Portal/Admin)
3. `GET /api/device/bootstrap`
4. `GET /api/device/config/version`
5. `POST /api/device/recover`
6. `POST /api/device/events`

Base URL:
- `http://<host>:3001`

Content type:
- `application/json`

Device authentication (recommended):
- `x-device-key: <device_api_key>` for all device runtime endpoints (`bootstrap`, `config/version`, `recover`, `events`)
- `register` is onboarding and may use registration code only.

---

## 1) Register (first onboarding)

Endpoint:
- `POST /api/device/register`

Purpose:
- First-time onboarding with registration code.
- Returns device identity and initial scope.

Request (IOT example):
```json
{
  "registrationCode": "REG-XXXX",
  "registerType": "iot",
  "spare": false,
  "macAddress": "3C:E9:0E:54:C6:22",
  "fwVersion": "1.2.3",
  "name": "IOT-DM-22",
  "model": "ESP32-S3"
}
```

Success response:
```json
{
  "ok": true,
  "scope": {
    "tenant": { "code": "EIT", "name": "EIT" },
    "merchant": { "code": "RGH18", "name": "RGH18" },
    "branch": { "code": "RGH18", "name": "RGH18" }
  },
  "device": {
    "id": "cmoxxx",
    "macAddress": "3C:E9:0E:54:C6:22",
    "deviceUid": "22C6540EE93C",
    "status": "NEW"
  }
}
```

Notes:
- `registerType` supports `asset | iot | machine`.
- `spare=true` means register as spare inventory.
- Registration code should be consumed only on new successful onboarding.

---

## 2) Activate / Bind

Endpoint options:
- `POST /api/device/activate` (if implemented as direct API)
- Or existing bind workflow via Portal/Admin.

Purpose:
- Attach device to business runtime context (`Asset -> Branch -> Merchant`).
- Make device operational.

Expected outcome:
- Device becomes bound/active according to lifecycle rules.
- Runtime config becomes available for bootstrap.

---

## 3) Bootstrap runtime config

Endpoint:
- `GET /api/device/bootstrap?deviceUid=<UID>`

Headers:
```http
x-device-key: <device_api_key>
```

Purpose:
- Device fetches full runtime configuration to operate.

Success response (example):
```json
{
  "ok": true,
  "configVersion": "2026-05-10T03:40:00.000Z",
  "scope": {
    "tenant": { "code": "EIT", "name": "EIT" },
    "merchant": { "code": "RGH18", "name": "RGH18" },
    "branch": { "code": "RGH18", "name": "RGH18" }
  },
  "asset": { "id": "a1", "code": "AS-001", "name": "Dryer-01" },
  "device": { "deviceUid": "22C6540EE93C", "macAddress": "3C:E9:0E:54:C6:22" },
  "machine": { "id": "m1", "serialNo": "SN001", "kind": "DRYER" },
  "products": [
    { "productId": "p1", "name": "Dry-40-60", "price": 40, "service": "60 unit" }
  ],
  "mqtt": {
    "broker": "mqtts://broker.example.com:8883",
    "pubTopic": "tenant/EIT/device/22C6540EE93C/events",
    "subTopic": "tenant/EIT/device/22C6540EE93C/commands"
  },
  "paymentPolicy": {
    "allowSlipVerify": true,
    "allowCash": false
  }
}
```

---

## 4) Config version check

Endpoint:
- `GET /api/device/config/version?deviceUid=<UID>`

Headers:
```http
x-device-key: <device_api_key>
```

Purpose:
- Lightweight polling for config changes.

Success response:
```json
{
  "ok": true,
  "configVersion": "2026-05-10T03:40:00.000Z",
  "changed": false
}
```

Device behavior:
- If `changed=true`, call `bootstrap` immediately.

---

## 5) Recover (NVRAM lost / reflashed)

Endpoint:
- `POST /api/device/recover`

Headers:
```http
x-device-key: <device_api_key>
```

Request:
```json
{
  "deviceUid": "22C6540EE93C",
  "reason": "nvram_lost"
}
```

Purpose:
- Recover full runtime config after local config loss.
- Must not consume registration code.

Success response (example):
```json
{
  "ok": true,
  "recovered": true,
  "configVersion": "2026-05-10T03:40:00.000Z",
  "scope": {
    "tenant": { "code": "EIT", "name": "EIT" },
    "merchant": { "code": "RGH18", "name": "RGH18" },
    "branch": { "code": "RGH18", "name": "RGH18" }
  },
  "asset": { "id": "a1", "code": "AS-001", "name": "Dryer-01" },
  "machine": { "id": "m1", "serialNo": "SN001", "kind": "DRYER" },
  "products": [
    { "productId": "p1", "name": "Dry-40-60", "price": 40, "service": "60 unit" }
  ],
  "mqtt": {
    "broker": "mqtts://broker.example.com:8883",
    "pubTopic": "tenant/EIT/device/22C6540EE93C/events",
    "subTopic": "tenant/EIT/device/22C6540EE93C/commands"
  }
}
```

---

## 6) Device events (telemetry/audit)

Endpoint:
- `POST /api/device/events`

Headers:
```http
x-device-key: <device_api_key>
```

Request:
```json
{
  "deviceUid": "22C6540EE93C",
  "eventType": "payment_received",
  "eventAt": "2026-05-10T04:00:00.000Z",
  "severity": "info",
  "data": {
    "orderCode": "ODR-001",
    "amount": 40,
    "channel": "SLIP_VERIFY"
  }
}
```

Success response:
```json
{
  "ok": true
}
```

---

## Standard Error Contract

Recommended HTTP status mapping:
- `400` invalid payload
- `401` authentication failed (`x-device-key` invalid)
- `404` device/code not found
- `409` conflict/state mismatch (used code, not ready, not bound)
- `410` registration code expired
- `500` internal server error

Recommended error body:
```json
{
  "error": true,
  "statusCode": 409,
  "statusMessage": "Registration code is not ready",
  "message": "Registration code is not ready"
}
```

---

## Firmware Runtime Flow (recommended)

1. First boot: call `register`.
2. Poll `bootstrap` every 10-30s until config is complete.
3. Enter RUN mode.
4. Poll `config/version` periodically.
5. If changed, re-fetch `bootstrap`.
6. Send `events` for telemetry/business/audit events.
7. If local config lost, call `recover` and persist config to NVRAM.

---

## Notes for Implementation

- Keep `register` and `recover` separate responsibilities.
- Do not consume registration codes on recover flow.
- Log all recover attempts and event writes (audit-friendly).
- Keep response fields stable for firmware compatibility.
