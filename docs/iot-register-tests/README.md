# IOTDevice Register Test Suite / ชุดทดสอบการลงทะเบียน IOTDevice

## EN
### Endpoint
- `POST /api/device/register` (single endpoint)
- Source: `/server/api/device/register.post.ts`

### Preconditions
1. Dev server is running (`http://localhost:3001`).
2. At least one `deviceRegistrationCode` is `READY` and not expired.
3. `machineKind` exists in master (e.g. `WASHER`, `DRYER`).

### Test files
- Success (asset): `payloads/01-success.json`
- Success (iot): `payloads/01-success-new-iot-device.json`
- Success (machine): `payloads/01-success-new-machine.json`
- Negative:
  - `payloads/02-invalid-registration-code.json`
  - `payloads/03-expired-or-not-ready-code.json`
  - `payloads/04-invalid-machine-serial-length.json` (empty serial)
  - `payloads/05-invalid-machine-kind.json`
  - `payloads/06-missing-required-field.json`

### Run
- All cases:
```bash
bash docs/iot-register-tests/run-register-tests.sh
```
- Single case:
```bash
curl -X POST 'http://localhost:3001/api/device/register' \
  -H 'Content-Type: application/json' \
  --data @docs/iot-register-tests/payloads/01-success.json
```

- IOT:
```bash
curl -X POST 'http://localhost:3001/api/device/register' \
  -H 'Content-Type: application/json' \
  --data @docs/iot-register-tests/payloads/01-success-new-iot-device.json
```

- Machine:
```bash
curl -X POST 'http://localhost:3001/api/device/register' \
  -H 'Content-Type: application/json' \
  --data @docs/iot-register-tests/payloads/01-success-new-machine.json
```

### Expected results
1. `01-success.json`
- HTTP `200`
- Includes `ok: true`, `tenantCode`, `branchCode`, `machine`, `device`, `deviceApiKey`

1.1 `01-success-new-iot-device.json`
- HTTP `200`
- Includes `ok: true`, `tenantCode`, `device`

1.2 `01-success-new-machine.json`
- HTTP `200`
- Includes `ok: true`, `tenantCode`, `machine`

2. `02-invalid-registration-code.json`
- HTTP `404`
- `statusMessage: "Invalid registration code"`

3. `03-expired-or-not-ready-code.json`
- HTTP `409` (not READY) or `410` (expired)

4. `04-invalid-machine-serial-length.json` (empty serial)
- HTTP `400` (validation error)

5. `05-invalid-machine-kind.json`
- HTTP `4xx` (machine kind validation error)

6. `06-missing-required-field.json`
- HTTP `400` (validation error)

### Replace placeholders
- `<READY_REGISTRATION_CODE>`
- `<EXPIRED_OR_USED_CODE>`
- `<READY_NEW_IOT_DEVICE_CODE>`
- `<READY_NEW_MACHINE_CODE>`

### Notes
- Success case consumes registration code (`READY -> USED`).
- Generate new READY code for repeatable tests.

---

## TH
### Endpoint
- `POST /api/device/register` (endpoint เดียว)
- ไฟล์โค้ด: `/server/api/device/register.post.ts`

### เงื่อนไขก่อนทดสอบ
1. เปิด dev server แล้ว (`http://localhost:3001`)
2. มี `deviceRegistrationCode` ที่สถานะ `READY` และยังไม่หมดอายุอย่างน้อย 1 โค้ด
3. มี `machineKind` ใน master แล้ว (เช่น `WASHER`, `DRYER`)

### ไฟล์ทดสอบ
- เคสสำเร็จ (asset): `payloads/01-success.json`
- เคสสำเร็จ (iot): `payloads/01-success-new-iot-device.json`
- เคสสำเร็จ (machine): `payloads/01-success-new-machine.json`
- เคสผิดพลาด:
  - `payloads/02-invalid-registration-code.json`
  - `payloads/03-expired-or-not-ready-code.json`
  - `payloads/04-invalid-machine-serial-length.json` (serial ว่าง)
  - `payloads/05-invalid-machine-kind.json`
  - `payloads/06-missing-required-field.json`

### วิธีรัน
- รันทุกเคส:
```bash
bash docs/iot-register-tests/run-register-tests.sh
```
- รันเคสเดียว:
```bash
curl -X POST 'http://localhost:3001/api/device/register' \
  -H 'Content-Type: application/json' \
  --data @docs/iot-register-tests/payloads/01-success.json
```

- รัน IOT:
```bash
curl -X POST 'http://localhost:3001/api/device/register' \
  -H 'Content-Type: application/json' \
  --data @docs/iot-register-tests/payloads/01-success-new-iot-device.json
```

- รัน Machine:
```bash
curl -X POST 'http://localhost:3001/api/device/register' \
  -H 'Content-Type: application/json' \
  --data @docs/iot-register-tests/payloads/01-success-new-machine.json
```

### ผลลัพธ์ที่คาดหวัง
1. `01-success.json`
- HTTP `200`
- มีค่า `ok: true`, `tenantCode`, `branchCode`, `machine`, `device`, `deviceApiKey`

1.1 `01-success-new-iot-device.json`
- HTTP `200`
- มีค่า `ok: true`, `tenantCode`, `device`

1.2 `01-success-new-machine.json`
- HTTP `200`
- มีค่า `ok: true`, `tenantCode`, `machine`

2. `02-invalid-registration-code.json`
- HTTP `404`
- `statusMessage: "Invalid registration code"`

3. `03-expired-or-not-ready-code.json`
- HTTP `409` (โค้ดไม่ READY) หรือ `410` (โค้ดหมดอายุ)

4. `04-invalid-machine-serial-length.json` (serial ว่าง)
- HTTP `400` (validation error)

5. `05-invalid-machine-kind.json`
- HTTP `4xx` (machine kind validation error)

6. `06-missing-required-field.json`
- HTTP `400` (validation error)

### จุดที่ต้องแก้ก่อนรัน
- `<READY_REGISTRATION_CODE>`
- `<EXPIRED_OR_USED_CODE>`
- `<READY_NEW_IOT_DEVICE_CODE>`
- `<READY_NEW_MACHINE_CODE>`

### หมายเหตุ
- เคสสำเร็จจะใช้ registration code ไปทันที (`READY -> USED`)
- ถ้าจะทดสอบซ้ำ ให้สร้างโค้ด READY ใหม่
