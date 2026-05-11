# MQTT Event Contract (Device Control + Payment)

This document defines MQTT event types, topic contract, payload contract, and processing flow for this platform.

## 1) Event Sources: Automatic vs Manual

### Automatic events
These are emitted without human action:
- **Device-originated**: ESP32/MCU sends status, heartbeat, telemetry, cash events, command ACK.
- **Broker-originated**: LWT/offline events when device disconnects unexpectedly.
- **System-originated**: backend publishes command and emits command lifecycle traces.

### Manual events
These are triggered by operator/admin:
- Calling internal reconcile endpoint for recovery.
- Admin override flows (future optional).

## 2) Topic Convention (Recommended)

Use tenant/branch/device scoping to avoid cross-scope leakage.

- `tenant/{tenantCode}/branch/{branchCode}/device/{deviceCode}/status`
- `tenant/{tenantCode}/branch/{branchCode}/device/{deviceCode}/heartbeat`
- `tenant/{tenantCode}/branch/{branchCode}/device/{deviceCode}/event`
- `tenant/{tenantCode}/branch/{branchCode}/device/{deviceCode}/cash/confirm`
- `tenant/{tenantCode}/branch/{branchCode}/device/{deviceCode}/command/ack`

Current backend compatible behavior:
- `POST /api/mqtt/events` can parse by `payload.eventType` and by topic pattern (`contains('cash')` or `contains('/ack')`).

## 3) Event Types and Payload Contracts

## 3.1 Cash payment confirm (automatic from device)

Used to confirm payment from coin/bill acceptor.

`eventType`: `cash_payment_confirm` (aliases accepted: `cash_confirm`, `coin_bill_paid`)

```json
{
  "eventType": "cash_payment_confirm",
  "eventId": "evt-cash-20260509-0001",
  "orderNumber": "ORD-ABCDEFG1",
  "amountPaid": 40,
  "currency": "THB",
  "deviceCode": "ESP32-RGH18-01",
  "assetCode": "RGH18-0001",
  "confirmedAt": "2026-05-09T10:30:00.000Z"
}
```

Processing:
1. Inbound event hits `/api/mqtt/events`.
2. System resolves payment by `paymentId` or `orderId` or `orderNumber`.
3. If amount is enough, set `payment.status=VERIFIED`, `paymentMethod=CASH_DEVICE`, `order.status=CONFIRMED`.
4. Call `startOrderMachines(orderId)`.
5. Persist audit trace in `payment_traces` + `mqtt_traces`.

Idempotency:
- `deviceEventRef`/`eventId` is used to avoid duplicate confirmations.

## 3.2 Device command ACK (automatic from device)

Used to update command lifecycle.

`eventType`: `device_command_ack` (aliases accepted: `device_ack`, `machine_ack`)

```json
{
  "eventType": "device_command_ack",
  "commandRef": "cmd-orderItemId-1715230000000",
  "machineCode": "RGH18-WM-01",
  "orderItemId": "cmxxxxxx",
  "ackStatus": "DONE",
  "note": "Program completed"
}
```

`ackStatus` mapping:
- `ACK` => command status `ACKNOWLEDGED`
- `DONE`/`COMPLETED` => command status `COMPLETED`, machine back to `AVAILABLE`, order item to `COMPLETED`
- `FAILED`/`ERROR` => command status `FAILED`

Processing:
1. Inbound event hits `/api/mqtt/events` or `/api/mqtt/device-ack`.
2. Resolve command by `commandRef` (preferred) or fallback identifiers.
3. Update `DeviceCommand` and related machine/order item state.
4. Persist `mqtt_traces`.

## 3.3 Heartbeat/status (automatic from device or broker)

Recommended contract (to implement progressively):

```json
{
  "eventType": "device_heartbeat",
  "deviceCode": "ESP32-RGH18-01",
  "uptimeSec": 86400,
  "rssi": -63,
  "firmware": "1.2.3",
  "sentAt": "2026-05-09T10:31:00.000Z"
}
```

```json
{
  "eventType": "device_status",
  "deviceCode": "ESP32-RGH18-01",
  "status": "offline",
  "reason": "broker_lwt"
}
```

Use cases:
- Health dashboard
- Offline alerting
- SLA tracking
- Prevent dispatching commands to offline devices

## 4) Security Requirements

1. Validate webhook secret (`x-mqtt-secret`) on ingress.
2. Use unique `eventId`/`commandRef` for deduplication.
3. Prefer signed payload/HMAC at device layer (recommended next phase).
4. Enforce tenant/branch scoping from topic and payload.

## 5) Retry, Timeout, Dead-letter

Current hardening:
- `DeviceCommand` supports `retryCount`, `maxRetries`, `lastAttemptAt`, `nextRetryAt`, `deadLetteredAt`.
- Reconcile endpoint: `POST /api/internal/device-commands/reconcile`
- This can be triggered by scheduler or by delayed-job loop.

Recommended evolution (no cron):
- Use BullMQ delayed jobs per command for timeout checks.
- If ACK not received in window: retry publish.
- If retry exhausted: mark dead-letter and emit ops alert.

## 6) Minimal End-to-End Flows

### A) QR/provider flow
1. Create order.
2. Payment verified by slip/provider callback.
3. `startOrderMachines` creates command + publish trace.
4. Device ACK updates command lifecycle.

### B) Cash-device flow
1. Create order (same API).
2. Device sends `cash_payment_confirm` via MQTT.
3. Payment/order confirmed automatically.
4. `startOrderMachines` runs.
5. Device ACK closes command.

## 7) Test Assets in Repository

- `docs/mqtt-payloads/cash-payment-confirm.mqtt-events.json`
- `docs/mqtt-payloads/cash-payment-confirm.direct-api.json`
- `docs/mqtt-payloads/device-command-ack.mqtt-events.json`
- `docs/mqtt-payloads/device-command-ack.direct-api.json`
- `docs/mqtt-payloads/device-command-reconcile.direct-api.json`
- `docs/mqtt-payloads/mqtt-control-hardening.curl.txt`

## 8) Firmware Quick-Start (Send Immediately)

Firmware should POST this envelope to `POST /api/mqtt/events`:

```json
{
  "tenantCode": "EIT",
  "topic": "tenant/EIT/branch/RGH18/device/ESP32-RGH18-01/event",
  "qos": 1,
  "status": "RECEIVED",
  "payload": { "eventType": "..." }
}
```

Required HTTP header:
- `x-mqtt-secret: <MQTT_WEBHOOK_SECRET>`

## 8.1 Cash Confirm Contract (Firmware)

Topic recommendation:
- `tenant/{tenantCode}/branch/{branchCode}/device/{deviceCode}/cash/confirm`

Payload fields:

| Field | Required | Type | Example | Rule |
|---|---|---|---|---|
| `eventType` | yes | string | `cash_payment_confirm` | Use this value (or accepted alias). |
| `eventId` | yes | string | `evt-cash-20260509-0001` | Unique per event (idempotency key). |
| `orderNumber` | yes* | string | `ORD-ABCDEFG1` | Send at least one of `orderNumber/orderId/paymentId` (recommend `orderNumber`). |
| `orderId` | optional | string | `cmxxx` | Optional alternate key. |
| `paymentId` | optional | string | `cmxxx` | Optional alternate key. |
| `amountPaid` | yes | number(int) | `40` | Must be `>= payment.amount` to confirm. |
| `currency` | optional | string | `THB` | Default THB in current system. |
| `deviceCode` | optional | string | `ESP32-RGH18-01` | Recommended for audit. |
| `assetCode` | optional | string | `RGH18-0001` | Recommended for audit. |
| `confirmedAt` | optional | ISO datetime | `2026-05-09T10:30:00.000Z` | Device timestamp. |

## 8.2 Command ACK Contract (Firmware)

Topic recommendation:
- `tenant/{tenantCode}/branch/{branchCode}/device/{deviceCode}/command/ack`

Payload fields:

| Field | Required | Type | Example | Rule |
|---|---|---|---|---|
| `eventType` | yes | string | `device_command_ack` | Preferred value. |
| `commandRef` | yes | string | `cmd-orderItemId-1715230000000` | Must match command sent by backend. |
| `machineCode` | yes | string | `RGH18-WM-01` | Must match target machine. |
| `ackStatus` | yes | string | `ACK`/`DONE`/`FAILED` | Status mapping is strict. |
| `orderItemId` | optional | string | `cmxxxxxx` | Fallback lookup key. |
| `note` | optional | string | `Program completed` | Error/details text. |
| `eventId` | recommended | string | `evt-ack-20260509-0001` | Recommended for traceability. |
| `sentAt` | optional | ISO datetime | `2026-05-09T10:40:00.000Z` | Device timestamp. |

ACK mapping:
- `ACK` -> command becomes `ACKNOWLEDGED`
- `DONE` / `COMPLETED` -> command becomes `COMPLETED`
- `FAILED` / `ERROR` -> command becomes `FAILED`

## 8.3 Validation Checklist (Firmware Release Gate)

- Secret header is always present.
- `eventId` uniqueness guaranteed per device (no reuse).
- `commandRef` echoed exactly from command payload.
- Topic contains correct tenant/branch/device.
- `amountPaid` uses integer minor unit aligned with backend (current: THB integer).
- Retry on network error uses same `eventId` (idempotent resend).

## 8.4 Device Retry Behavior (Recommended)

For each event publish:
1. Send event (QoS 1).
2. If HTTP/MQTT bridge fails, retry with exponential backoff: 1s, 2s, 4s, 8s (max 5 attempts).
3. Keep same `eventId` for retries of the same logical event.
4. If still failed, store in local spool and resend when network recovers.

## 8.5 Copy/Paste Templates

Cash confirm payload:

```json
{
  "eventType": "cash_payment_confirm",
  "eventId": "evt-cash-20260509-0001",
  "orderNumber": "ORD-ABCDEFG1",
  "amountPaid": 40,
  "currency": "THB",
  "deviceCode": "ESP32-RGH18-01",
  "assetCode": "RGH18-0001",
  "confirmedAt": "2026-05-09T10:30:00.000Z"
}
```

Command ACK payload:

```json
{
  "eventType": "device_command_ack",
  "eventId": "evt-ack-20260509-0001",
  "commandRef": "cmd-orderItemId-1715230000000",
  "machineCode": "RGH18-WM-01",
  "orderItemId": "cmxxxxxx",
  "ackStatus": "DONE",
  "note": "Program completed",
  "sentAt": "2026-05-09T10:40:00.000Z"
}
```
