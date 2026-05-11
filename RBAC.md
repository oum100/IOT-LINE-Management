# RBAC Matrix (Phase 1 Baseline)

## Roles

- `ADMIN`: Platform Admin
- `USER`: Platform Read-only User
- `OWNER`: Tenant (Portal) Admin
- `MANAGER`: Tenant (Portal) Manager
- `STAFF`: Tenant (Portal) Operator

## Scope Rules

- `ADMIN`, `USER`:
  - Access: `/platform/*`, `/admin/*`
  - Data scope: cross-tenant (platform-wide)
- `OWNER`, `MANAGER`, `STAFF`:
  - Access: `/app/*`
  - Data scope: own tenant only

## Enforcement Model (Mandatory)

- API is the source of truth. UI visibility is convenience only.
- Deny-by-default for all protected endpoints:
  - missing permission => `403`
  - unresolved required scope => `403`
  - target outside scope => `404` or `403` without leaking existence details
- Every protected endpoint must apply BOTH:
  1. permission check
  2. scope check in DB queries
- `MANAGER` / `STAFF` must be constrained by `UserScopeAssignment` when assignment exists.
- Platform read-only users (`USER`) must never execute mutation endpoints.

## Permissions

### Platform

- `platform.dashboard.read`
- `platform.expense.read`
- `platform.master.manage` (tenant/merchant/branch/asset master data)
- `platform.user.manage`

### Portal

- `portal.dashboard.read`
- `portal.revenue.read`
- `portal.expense.read`
- `portal.expense.manage`
- `portal.governance.read`
- `portal.user.manage`
- `portal.settings.manage`
- `portal.merchant.read`
- `portal.merchant.manage`
- `portal.branch.read`
- `portal.branch.manage`
- `portal.asset.read`
- `portal.asset.manage.global`
- `portal.asset.manage.scoped`
- `portal.order.manage`
- `portal.refund.manage`

## Role x Permission Matrix

| Permission | ADMIN | USER | OWNER | MANAGER | STAFF |
|---|---|---|---|---|---|
| `platform.dashboard.read` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `platform.expense.read` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `platform.master.manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `platform.user.manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `portal.dashboard.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.revenue.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.expense.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.expense.manage` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `portal.governance.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.user.manage` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `portal.settings.manage` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `portal.merchant.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.merchant.manage` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `portal.branch.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.branch.manage` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `portal.asset.read` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.asset.manage.global` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `portal.asset.manage.scoped` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.order.manage` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `portal.refund.manage` | ✅ | ❌ | ✅ | ✅ | ✅ |

## Scope Assignment Model

- Main model: `UserScopeAssignment`
- Purpose: assign a portal user to specific merchant/branch scope without creating extra roles.

### Fields

- `userId`
- `tenantId`
- `scopeType`: `MERCHANT` or `BRANCH`
- `merchantAccountId` (optional)
- `branchId` (optional)
- `active`

### Usage

- `OWNER`: usually tenant-wide (can work without scoped rows)
- `MANAGER`: assign one/many merchant and/or branch rows
- `STAFF`: assign branch rows for operational access

### Enforcement Rule

- API must apply both:
  1. permission check by role
  2. scope filter by `UserScopeAssignment` for `MANAGER` / `STAFF`

## Guardrails

- `OWNER/MANAGER/STAFF` must never access platform routes (`/platform/*`, `/admin/*`).
- `USER` (platform read-only) must not perform create/update/delete.
- `MANAGER` and `STAFF` must not manage users or critical settings.
- Portal-side delete/update actions must always validate tenant ownership at API layer.
- Cross-scope destructive actions must require explicit user confirmation in UI and be audited in API.

## Action-Level Permissions (Recommended Baseline)

- Avoid over-broad keys for all mutations in one module.
- Prefer explicit action keys where possible:
  - `*.read`
  - `*.create`
  - `*.update`
  - `*.delete`
  - `*.pause`
  - `*.resume`
  - `*.replace`
- Until key split is complete, keep current keys but enforce strict scope and state guards.

## Migration Note

- Legacy key `portal.asset.manage` is kept in backend compatibility mapping.
- New code should use:
  - `portal.asset.read`
  - `portal.asset.manage.global`
  - `portal.asset.manage.scoped`

## Notes for Implementation

- UI layer:
  - Hide menu/actions by permission.
- API layer:
  - Enforce permission check at every endpoint.
- Priority:
  1. API enforcement first
  2. UI visibility second

## Audit Requirements (Mandatory)

- Record audit event for critical mutations:
  - actor id + role
  - effective scope
  - action + target
  - before/after snapshot (when practical)
  - timestamp

## Thai Quick Mockup (ใช้งานจริง)

### ตารางสิทธิ์แบบเข้าใจง่าย

| หน้า/ความสามารถ | Platform Admin | Tenant Owner | Manager/Staff |
|---|---|---|---|
| `/admin/register-codes` | ได้ | ไม่ได้ | ไม่ได้ |
| `/admin/device-keys` | ได้ | ไม่ได้ | ไม่ได้ |
| `/admin/assets`, `/admin/devices`, `/admin/machine` | ได้ | ไม่ได้ | ไม่ได้ |
| `/app/status`, `/app/revenue`, `/app/operation`, `/app/bizstructure` | ไม่ได้ | ได้ (ตาม tenant) | ได้ (ตาม scope ที่ได้รับ) |
| `/app/promotion` ดูรายการ | ไม่ได้ | ได้ | ได้ (เฉพาะ merchant/branch ที่ได้รับ) |
| `/app/promotion` ตั้งโปร/พักโปร/เปิดต่อ/ลบ | ไม่ได้ | ได้ | ได้ (เฉพาะ scope ที่ได้รับ) |
| เปลี่ยน query เองเพื่อดูข้าม scope | - | ถูกบล็อก `403` | ถูกบล็อก `403` |
| `/app/user` ดูรายการ user | ไม่ได้ | ได้ | ได้ตามนโยบาย |
| `/app/user` create/edit user | ไม่ได้ | ได้ | ควรจำกัด (แนะนำ Owner เป็นหลัก) |
| Reset password ใน `/app/user` | ไม่ได้ | ได้ | ไม่ได้ |

### สรุประดับการจัดการ

- Platform Admin:
  - ดูแลระบบรวมทั้ง platform
  - จัดการ security primitives เช่น register code และ device keys
- Tenant Owner:
  - ดูแลธุรกิจภายใน tenant ของตัวเอง
  - จัดการผู้ใช้และการตั้งค่าระดับ tenant
- Manager/Staff:
  - ทำงานหน้างานตาม scope ที่ถูก assign เท่านั้น
  - ห้ามข้าม merchant/branch scope

### ข้อความแนะนำเมื่อเจอ 403

- `คุณไม่มีสิทธิ์ใน scope นี้ กรุณาติดต่อ Tenant Owner หรือ Platform Admin เพื่อปรับสิทธิ์`
