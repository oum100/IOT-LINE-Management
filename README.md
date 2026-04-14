# Laundry LINE IoT Management

Nuxt 4 scaffold สำหรับร้านสะดวกซักที่มี flow ครบตั้งแต่:

- เลือกหลายเครื่องซักและอบในออเดอร์เดียว
- ออก PromptPay QR จากยอดรวม
- อัปโหลดสลิปเพื่อรอตรวจสอบ
- approve payment แล้วคิวคำสั่ง IoT ไปยังเครื่อง
- แจ้งเตือนลูกค้าเมื่อเริ่มงานและเมื่อเสร็จงาน

## Stack

- Nuxt 4 + Nuxt UI
- @sidebase/nuxt-auth (Auth.js)
- Pinia + persisted state
- Prisma + PostgreSQL
- BullMQ + Redis
- PromptPay QR payload
- Resend notification stub
- Prometheus metrics endpoint

## Quick start

```bash
cp .env.example .env
bun install
bun run db:push
bun run db:seed
bun run dev
```

เปิด `http://localhost:3000`

ค่าเริ่มต้นของฐานข้อมูล:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/iot-merchant?schema=public"
```

ให้สร้าง database `iot-merchant` ใน PostgreSQL ก่อน แล้วค่อยรัน `bun run db:push`

## Important routes

- `/` หน้า LINE-style frontend สำหรับลูกค้า
- `/orders/:id` หน้า payment, slip upload และติดตามสถานะ
- `GET /api/machines` รายการเครื่องพร้อมราคา
- `POST /api/orders` สร้างออเดอร์และ payment
- `POST /api/orders/:id/slip` อัปโหลดสลิป
- `POST /api/orders/:id/verify-slip` admin approve/reject
- `POST /api/orders/:id/complete` ปิดงานเมื่อเครื่องแจ้งว่าเสร็จ
- `GET /api/metrics` Prometheus metrics

## Auth (User/Admin)

- ใช้ `@sidebase/nuxt-auth` + Auth.js adapter กับ Prisma
- หน้า sign-in: `/auth/signin`
- รองรับ:
  - Email/Password (`credentials`)
  - Google OAuth (เมื่อใส่ `GOOGLE_CLIENT_ID/SECRET`)
  - LINE OAuth (เมื่อใส่ `LINE_LOGIN_CLIENT_ID/SECRET`)
  - Magic Link (เมื่อใส่ `RESEND_API_KEY` และ `AUTH_MAGIC_LINK_FROM`)

Endpoints เพิ่ม:

- `POST /api/auth/register` สมัคร user แบบ email/password
- `GET /api/auth/whoami` เช็ค session ปัจจุบัน

## Admin CRUD API

ทุก endpoint ใช้ admin session หรือ `x-admin-key`

- `/api/admin/tenants`
- `/api/admin/merchants`
- `/api/admin/branches`
- `/api/admin/assets`
- `/api/admin/machines`
- `/api/admin/devices` (IoT device)
- `/api/admin/users`

Device ops เพิ่ม:

- `/api/admin/device-registration-codes` สร้าง/จัดการ code สำหรับ onboard IoT
- `/api/admin/device-keys` ออก/จัดการ API key ของ IoT device
- `POST /api/device/register` auto add/register จาก IoT code

## LINE integration

โปรเจกต์นี้เตรียมจุดต่อไว้แล้วสำหรับ:

- ใช้ LIFF ดึง profile แล้วผูกกับ `lineUserId`
- ส่ง push notification หลังตรวจสลิปและหลังเครื่องเสร็จ
- รับ webhook จาก LINE OA หรือ backend bridge เพื่ออัปเดตสถานะออเดอร์

## IoT bridge

ตอนนี้ `server/workers/device-command.ts` เป็น worker ตัวอย่างสำหรับอ่าน BullMQ job แล้วส่งคำสั่งไปยัง bridge จริง เช่น MQTT, HTTP, Modbus gateway หรือ ESP32 relay service

## Demo flow

1. Seed เครื่อง 4 ตัวพร้อมราคา 3 ระดับต่อเครื่อง
2. ลูกค้าเลือกหลายรายการในหน้าแรก
3. ระบบสร้างออเดอร์และ PromptPay payload
4. ลูกค้าอัปโหลดสลิป
5. กดปุ่ม demo approve ในหน้า order เพื่อจำลอง admin ตรวจสอบ
6. ระบบเปลี่ยนสถานะ order เป็น `IN_PROGRESS` และ queue คำสั่งเครื่อง
7. เรียก `POST /api/orders/:id/complete` เมื่อเครื่องส่งสถานะเสร็จกลับมา

## Next step ที่แนะนำ

- ต่อ LIFF login จริง
- ทำ admin dashboard สำหรับตรวจสลิป
- เชื่อม OCR / slip validation จริง
- เชื่อม device bridge จริงเพื่อเริ่มและจบงานตามสถานะเครื่อง
